import crypto from "crypto";

import {
  InvoiceStatus,
  Prisma,
  PrismaClient,
  ReportPayment,
  UserReportArtifact,
  UserRole,
} from "@prisma/client";

import { env } from "../config/env";
import {
  CreateMolliePaymentInput,
  ReportType,
} from "../schemas/payments.schema";
import { MollieClientService, MolliePayment } from "./mollie-client.service";
import { InvoicesRepository } from "../repositories/invoices.repository";
import { ReportPaymentsRepository } from "../repositories/report-payments.repository";
import { SavedReportsRepository } from "../repositories/saved-reports.repository";
import { UserAddressSearchesService } from "./user-address-searches.service";
import { ReportPriceSettingsService } from "./report-price-settings.service";
import { InvoicePdfService } from "./invoice-pdf.service";

type CreateCheckoutResult = {
  checkoutUrl: string;
  paymentId: string;
  checkoutToken: string;
};

type PaidReportAccessInput = {
  reportType: ReportType;
  reportId: string;
  paymentId: string;
  checkoutToken: string;
};

type AddressReuseAccessInput = {
  userId: number;
  reportType: ReportType;
  address: string;
};

type CurrentUser = {
  userId: number;
  role: UserRole;
};

type CreateMollieCheckoutOptions = {
  userId?: number;
};

type InvoicePricingSnapshot = {
  amountCents: number;
  subtotalAmountCents: number;
  vatAmountCents: number;
  totalAmountCents: number;
  currency: string;
  vatType: "ZERO" | "INCLUSIVE" | "EXCLUSIVE";
  vatRateBps: number;
  vatSlabId: number | null;
  vatSlabCode: string | null;
  vatSlabName: string | null;
};

const PAID_REPORT_ACCESS_WINDOW_MS = 24 * 60 * 60 * 1000;

export class ReportPaymentsService {
  private readonly invoicesRepository: InvoicesRepository;
  private readonly reportPaymentsRepository: ReportPaymentsRepository;
  private readonly savedReportsRepository: SavedReportsRepository;
  private readonly reportPriceSettingsService: ReportPriceSettingsService;
  private readonly userAddressSearchesService: UserAddressSearchesService;
  private readonly invoicePdfService: InvoicePdfService;
  private readonly mollieClient: MollieClientService;

  constructor(
    private readonly prisma: PrismaClient,
    mollieClient = new MollieClientService(),
  ) {
    this.invoicesRepository = new InvoicesRepository(prisma);
    this.reportPaymentsRepository = new ReportPaymentsRepository(prisma);
    this.savedReportsRepository = new SavedReportsRepository(prisma);
    this.reportPriceSettingsService = new ReportPriceSettingsService(prisma);
    this.userAddressSearchesService = new UserAddressSearchesService(prisma);
    this.invoicePdfService = new InvoicePdfService(prisma);
    this.mollieClient = mollieClient;
  }

  async createMollieCheckout(
    input: CreateMolliePaymentInput,
    options: CreateMollieCheckoutOptions = {},
  ): Promise<CreateCheckoutResult> {
    const checkoutToken = createCheckoutToken();
    const priceSetting = await this.reportPriceSettingsService.getByReportType(
      input.reportType,
    );
    const pricingSnapshot = createPricingSnapshot(priceSetting);
    const amountCents = pricingSnapshot.totalAmountCents;
    const userId =
      options.userId ?? (await this.getSavedReportOwnerId(input.reportId));
    const backendUrl = getPublicBackendUrl();
    const webhookUrl = buildPublicWebhookUrl(backendUrl);
    const provisionalRedirectUrl = buildMollieReturnUrl({
      backendUrl,
      checkoutToken,
    });

    const metadata = {
      checkoutToken,
      reportType: input.reportType,
      reportId: input.reportId,
      userId: userId ?? null,
      address: input.address ?? null,
      returnTo: input.returnTo ?? null,
      pricingSnapshot,
    };

    const molliePayment = await this.mollieClient.createPayment({
      amount: {
        currency: "EUR",
        value: formatEuroAmount(amountCents),
      },
      description: getPaymentDescription(input.reportType, input.reportId),
      redirectUrl: provisionalRedirectUrl,
      ...(webhookUrl ? { webhookUrl } : {}),
      metadata,
    });

    const redirectUrl = buildMollieReturnUrl({
      backendUrl,
      paymentId: molliePayment.id,
      checkoutToken,
    });
    const updatedPayment = await this.mollieClient.updatePayment(
      molliePayment.id,
      {
        redirectUrl,
        ...(webhookUrl ? { webhookUrl } : {}),
        metadata: {
          ...metadata,
          molliePaymentId: molliePayment.id,
        },
      },
    );
    const checkoutUrl =
      updatedPayment._links?.checkout?.href ||
      molliePayment._links?.checkout?.href;

    if (!checkoutUrl) {
      throw new Error("Mollie did not return a checkout URL");
    }

    const reportPayment = await this.reportPaymentsRepository.create({
      userId,
      molliePaymentId: molliePayment.id,
      checkoutToken,
      reportType: input.reportType,
      reportId: input.reportId,
      address: input.address,
      amountCents,
      currency: "EUR",
      status: normalizeMollieStatus(updatedPayment.status || molliePayment.status),
      checkoutUrl,
      returnTo: input.returnTo,
      metadata: toJsonValue({
        ...metadata,
        molliePaymentId: molliePayment.id,
      }),
    });

    if (userId && input.address) {
      await this.userAddressSearchesService.recordSearch({
        userId,
        reportType: input.reportType,
        reportId: input.reportId,
        address: input.address,
        paymentStatus: normalizeMollieStatus(
          updatedPayment.status || molliePayment.status,
        ),
        lastPaymentId: reportPayment.id,
        lastMolliePaymentId: reportPayment.molliePaymentId,
      });
    }

    return {
      checkoutUrl,
      paymentId: molliePayment.id,
      checkoutToken,
    };
  }

  async syncPaymentStatusById(paymentId: string) {
    const molliePayment = await this.mollieClient.getPayment(paymentId);
    return this.updateStoredPaymentFromMollie(molliePayment);
  }

  async handleReturn({
    paymentId,
    checkoutToken,
  }: {
    paymentId?: string;
    checkoutToken: string;
  }) {
    const storedPayment = paymentId
      ? await this.reportPaymentsRepository.findByMolliePaymentId(paymentId)
      : await this.reportPaymentsRepository.findByCheckoutToken(checkoutToken);

    if (!storedPayment || storedPayment.checkoutToken !== checkoutToken) {
      return {
        redirectUrl: buildFallbackReportUrl({
          reportType: "property-report",
          reportId: "",
          paymentState: "failed",
        }),
      };
    }

    const syncedPayment = await this.syncPaymentStatusById(
      storedPayment.molliePaymentId,
    );

    if (!syncedPayment) {
      return {
        redirectUrl: buildFallbackReportUrl({
          reportType: storedPayment.reportType as ReportType,
          reportId: storedPayment.reportId,
          returnTo: storedPayment.returnTo ?? undefined,
          paymentState: "failed",
          paymentId: storedPayment.molliePaymentId,
          checkoutToken: storedPayment.checkoutToken,
        }),
      };
    }

    if (syncedPayment.status === "paid") {
      return {
        redirectUrl: buildPaidReportUrl(syncedPayment),
      };
    }

    return {
      redirectUrl: buildFallbackReportUrl({
        reportType: syncedPayment.reportType as ReportType,
        reportId: syncedPayment.reportId,
        returnTo: syncedPayment.returnTo ?? undefined,
        paymentState: getFailureState(syncedPayment.status),
        paymentId: syncedPayment.molliePaymentId,
        checkoutToken: syncedPayment.checkoutToken,
      }),
    };
  }

  async hasPaidReportAccess({
    reportType,
    reportId,
    paymentId,
    checkoutToken,
  }: PaidReportAccessInput) {
    const storedPayment =
      await this.reportPaymentsRepository.findByMolliePaymentId(paymentId);

    if (
      !storedPayment ||
      storedPayment.reportType !== reportType ||
      storedPayment.reportId !== reportId ||
      storedPayment.checkoutToken !== checkoutToken
    ) {
      return false;
    }

    const syncedPayment = await this.syncPaymentStatusById(paymentId);
    return (
      syncedPayment?.status === "paid" &&
      isWithinPaidAccessWindow(
        syncedPayment.paidAt ?? syncedPayment.updatedAt ?? syncedPayment.createdAt,
      )
    );
  }

  async hasAddressReuseAccess(input: AddressReuseAccessInput) {
    const access = await this.userAddressSearchesService.checkAccess(input);
    return access.hasAccess;
  }

  async getAllForUser(currentUser: CurrentUser) {
    const payments =
      currentUser.role === "ADMIN"
        ? await this.reportPaymentsRepository.findAll()
        : await this.reportPaymentsRepository.findAllByUserId(currentUser.userId);

    return payments.map(toPublicReportPayment);
  }

  private async updateStoredPaymentFromMollie(molliePayment: MolliePayment) {
    const storedPayment =
      await this.reportPaymentsRepository.findByMolliePaymentId(
        molliePayment.id,
      );

    if (!storedPayment) {
      return null;
    }

    const status = normalizeMollieStatus(molliePayment.status);
    const invoiceId =
      status === "paid"
        ? await this.ensureInvoiceForPayment(storedPayment)
        : storedPayment.invoiceId ?? undefined;
    const paidAt =
      status === "paid"
        ? parseMollieDate(molliePayment.paidAt) ?? new Date()
        : null;

    if (storedPayment.userId && storedPayment.address) {
      await this.userAddressSearchesService.recordSearch({
        userId: storedPayment.userId,
        reportType: storedPayment.reportType as ReportType,
        reportId: storedPayment.reportId,
        address: storedPayment.address,
        paymentStatus: status,
        lastPaymentId: storedPayment.id,
        lastMolliePaymentId: storedPayment.molliePaymentId,
        invoiceId,
        paidAt: paidAt ?? undefined,
      });
    }

    return this.reportPaymentsRepository.updateByMolliePaymentId(
      molliePayment.id,
      {
        status,
        invoiceId,
        paidAt,
        metadata: toJsonValue(molliePayment.metadata ?? {}),
      },
    );
  }

  private async ensureInvoiceForPayment(payment: ReportPayment) {
    if (!payment.userId) {
      return payment.invoiceId ?? undefined;
    }

    if (payment.invoiceId) {
      const invoice = await this.invoicesRepository.findById(payment.invoiceId);
      if (invoice) {
        await this.invoicePdfService.ensurePdfForInvoice(invoice);
      }

      return payment.invoiceId;
    }

    const pricingSnapshot = getInvoicePricingSnapshot(payment);
    const invoice = await this.invoicesRepository.createOnceByProviderPayment({
      ...pricingSnapshot,
      userId: payment.userId,
      number: createInvoiceNumber(payment.molliePaymentId),
      description: getInvoiceDescription(payment),
      status: InvoiceStatus.PAID,
      provider: "mollie",
      providerId: payment.molliePaymentId,
    });
    await this.invoicePdfService.ensurePdfForInvoice(invoice);

    return invoice.id;
  }

  private async getSavedReportOwnerId(reportId: string) {
    const savedReportId = Number(reportId);

    if (!Number.isInteger(savedReportId) || savedReportId <= 0) {
      return undefined;
    }

    const savedReport = await this.savedReportsRepository.findById(savedReportId);
    return savedReport?.userId;
  }
}

export async function hasPaidReportAccess(
  prisma: PrismaClient,
  input: PaidReportAccessInput,
) {
  return new ReportPaymentsService(prisma).hasPaidReportAccess(input);
}

function buildMollieReturnUrl({
  backendUrl,
  paymentId,
  checkoutToken,
}: {
  backendUrl: string;
  paymentId?: string;
  checkoutToken: string;
}) {
  const url = new URL(`${backendUrl}${env.API_PREFIX}/payments/mollie/return`);

  if (paymentId) {
    url.searchParams.set("paymentId", paymentId);
  }

  url.searchParams.set("checkoutToken", checkoutToken);
  return url.toString();
}

function buildPaidReportUrl(payment: ReportPayment) {
  const reportType = payment.reportType as ReportType;

  return buildReportUrl({
    reportType,
    reportId: payment.reportId,
    address: payment.address ?? undefined,
    returnTo: getMatchingPaidReturnTo(reportType, payment.returnTo ?? undefined),
    paymentState: "paid",
    paymentId: payment.molliePaymentId,
    checkoutToken: payment.checkoutToken,
  });
}

function buildFallbackReportUrl({
  reportType,
  reportId,
  returnTo,
  paymentState,
  paymentId,
  checkoutToken,
}: {
  reportType: ReportType;
  reportId: string;
  returnTo?: string;
  paymentState: "cancelled" | "failed";
  paymentId?: string;
  checkoutToken?: string;
}) {
  return buildReportUrl({
    reportType,
    reportId,
    returnTo,
    paymentState,
    paymentId,
    checkoutToken,
  });
}

function buildReportUrl({
  reportType,
  reportId,
  address,
  returnTo,
  paymentState,
  paymentId,
  checkoutToken,
}: {
  reportType: ReportType;
  reportId: string;
  address?: string;
  returnTo?: string;
  paymentState: "paid" | "cancelled" | "failed";
  paymentId?: string;
  checkoutToken?: string;
}) {
  const url =
    returnTo && isSafeReturnTo(returnTo)
      ? new URL(returnTo, getFrontendUrl())
      : new URL(getReportPath(reportType, reportId, address), getFrontendUrl());

  url.searchParams.set("payment", paymentState);

  if (paymentId) {
    url.searchParams.set("paymentId", paymentId);
  }

  if (checkoutToken) {
    url.searchParams.set("checkoutToken", checkoutToken);
  }

  return url.toString();
}

function isSafeReturnTo(returnTo: string) {
  try {
    const frontendUrl = new URL(getFrontendUrl());
    const returnUrl = new URL(returnTo, frontendUrl);

    return returnUrl.origin === frontendUrl.origin;
  } catch {
    return false;
  }
}

function getMatchingPaidReturnTo(
  reportType: ReportType,
  returnTo: string | undefined,
) {
  if (!returnTo || !isSafeReturnTo(returnTo)) {
    return undefined;
  }

  try {
    const returnUrl = new URL(returnTo, getFrontendUrl());
    return matchesReportPath(reportType, returnUrl.pathname)
      ? returnTo
      : undefined;
  } catch {
    return undefined;
  }
}

function matchesReportPath(reportType: ReportType, pathname: string) {
  switch (reportType) {
    case "property-report":
      return pathname.startsWith("/report/");
    case "last-sale-report":
      return pathname === "/last-sale-report";
    case "sold-home-benchmark-report":
      return pathname === "/sold-home-benchmark-report";
  }
}

function getReportPath(reportType: ReportType, reportId: string, address?: string) {
  switch (reportType) {
    case "property-report":
      return withAddress(`/report/${encodeURIComponent(reportId)}`, address);
    case "last-sale-report":
      return withAddress(
        `/last-sale-report?id=${encodeURIComponent(reportId)}`,
        address,
      );
    case "sold-home-benchmark-report":
      return withAddress(
        `/sold-home-benchmark-report?id=${encodeURIComponent(reportId)}`,
        address,
      );
  }
}

function withAddress(pathnameAndSearch: string, address?: string) {
  if (!address) {
    return pathnameAndSearch;
  }

  const url = new URL(pathnameAndSearch, getFrontendUrl());
  url.searchParams.set("address", address);
  return `${url.pathname}${url.search}`;
}

function getFailureState(status: string): "cancelled" | "failed" {
  return status === "canceled" || status === "cancelled" || status === "expired"
    ? "cancelled"
    : "failed";
}

function getPaymentDescription(reportType: ReportType, reportId: string) {
  return `HuisScan ${reportType} ${reportId}`.slice(0, 255);
}

function getInvoiceDescription(payment: ReportPayment) {
  return `HuisScan ${payment.reportType}${payment.address ? ` - ${payment.address}` : ""}`.slice(
    0,
    255,
  );
}

function createInvoiceNumber(molliePaymentId: string) {
  return `HS-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${molliePaymentId.slice(-8).toUpperCase()}`;
}

function createPricingSnapshot(price: {
  amountCents: number;
  netAmountCents: number;
  vatAmountCents: number;
  totalAmountCents: number;
  currency: string;
  vatType: "ZERO" | "INCLUSIVE" | "EXCLUSIVE";
  vatSlabId: number;
  vatSlab: {
    code: string;
    name: string;
    rateBps: number;
  };
}): InvoicePricingSnapshot {
  return {
    amountCents: price.totalAmountCents,
    subtotalAmountCents: price.netAmountCents,
    vatAmountCents: price.vatAmountCents,
    totalAmountCents: price.totalAmountCents,
    currency: price.currency,
    vatType: price.vatType,
    vatRateBps: price.vatSlab.rateBps,
    vatSlabId: price.vatSlabId,
    vatSlabCode: price.vatSlab.code,
    vatSlabName: price.vatSlab.name,
  };
}

function getInvoicePricingSnapshot(payment: ReportPayment): InvoicePricingSnapshot {
  const metadata = asJsonObject(payment.metadata);
  const snapshot = asJsonObject(metadata?.pricingSnapshot);
  const amountCents = numberFromUnknown(snapshot?.amountCents);
  const subtotalAmountCents = numberFromUnknown(snapshot?.subtotalAmountCents);
  const vatAmountCents = numberFromUnknown(snapshot?.vatAmountCents);
  const totalAmountCents = numberFromUnknown(snapshot?.totalAmountCents);
  const vatRateBps = numberFromUnknown(snapshot?.vatRateBps);
  const vatType = vatTypeFromUnknown(snapshot?.vatType);

  if (
    amountCents !== null &&
    subtotalAmountCents !== null &&
    vatAmountCents !== null &&
    totalAmountCents !== null &&
    vatRateBps !== null &&
    vatType
  ) {
    return {
      amountCents,
      subtotalAmountCents,
      vatAmountCents,
      totalAmountCents,
      currency: stringFromUnknown(snapshot?.currency) ?? payment.currency,
      vatType,
      vatRateBps,
      vatSlabId: numberFromUnknown(snapshot?.vatSlabId),
      vatSlabCode: stringFromUnknown(snapshot?.vatSlabCode),
      vatSlabName: stringFromUnknown(snapshot?.vatSlabName),
    };
  }

  return {
    amountCents: payment.amountCents,
    subtotalAmountCents: payment.amountCents,
    vatAmountCents: 0,
    totalAmountCents: payment.amountCents,
    currency: payment.currency,
    vatType: "EXCLUSIVE",
    vatRateBps: 0,
    vatSlabId: null,
    vatSlabCode: null,
    vatSlabName: null,
  };
}

function asJsonObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function stringFromUnknown(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function vatTypeFromUnknown(
  value: unknown,
): "ZERO" | "INCLUSIVE" | "EXCLUSIVE" | null {
  return value === "ZERO" || value === "INCLUSIVE" || value === "EXCLUSIVE"
    ? value
    : null;
}

function formatEuroAmount(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

function normalizeMollieStatus(status: string) {
  return status === "canceled" ? "cancelled" : status;
}

function createCheckoutToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getPublicBackendUrl() {
  if (!env.PUBLIC_API_URL) {
    throw new Error("PUBLIC_API_URL is required to create Mollie payments");
  }

  return removeApiPrefixFromBaseUrl(env.PUBLIC_API_URL).replace(/\/$/, "");
}

function buildPublicWebhookUrl(backendUrl: string) {
  const url = new URL(`${backendUrl}${env.API_PREFIX}/payments/mollie/webhook`);

  if (!isPublicHttpsUrl(url)) {
    return undefined;
  }

  return url.toString();
}

function isPublicHttpsUrl(url: URL) {
  if (url.protocol !== "https:") {
    return false;
  }

  return !["localhost", "127.0.0.1", "::1"].includes(url.hostname);
}

function removeApiPrefixFromBaseUrl(value: string) {
  const url = new URL(value);
  const apiPrefix = env.API_PREFIX.replace(/\/$/, "");

  if (apiPrefix && url.pathname === apiPrefix) {
    url.pathname = "/";
  }

  return url.toString().replace(/\/$/, "");
}

function getFrontendUrl() {
  return (env.PUBLIC_APP_URL || env.FRONTEND_URL).replace(/\/$/, "");
}

function parseMollieDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isWithinPaidAccessWindow(value: Date | string | null | undefined) {
  if (!value) {
    return false;
  }

  const paidAt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(paidAt.getTime())) {
    return false;
  }

  return paidAt.getTime() + PAID_REPORT_ACCESS_WINDOW_MS > Date.now();
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function toPublicReportPayment(
  payment: ReportPayment & { artifacts?: UserReportArtifact[] },
) {
  return {
    id: payment.id,
    userId: payment.userId,
    invoiceId: payment.invoiceId,
    molliePaymentId: payment.molliePaymentId,
    checkoutToken: payment.checkoutToken,
    reportType: payment.reportType,
    reportId: payment.reportId,
    address: payment.address,
    amountCents: payment.amountCents,
    currency: payment.currency,
    status: payment.status,
    checkoutUrl: payment.checkoutUrl,
    artifacts: (payment.artifacts ?? []).map((artifact) => ({
      id: artifact.id,
      userId: artifact.userId,
      reportPaymentId: artifact.reportPaymentId,
      artifactType: artifact.artifactType,
      storageKey: artifact.storageKey,
      publicUrl: artifact.publicUrl,
      fileName: artifact.fileName,
      status: artifact.status,
      createdAt: artifact.createdAt,
      updatedAt: artifact.updatedAt,
    })),
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
