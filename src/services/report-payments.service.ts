import crypto from "crypto";

import {
  InvoiceStatus,
  Prisma,
  PrismaClient,
  ReportPayment,
  UserRole,
} from "@prisma/client";

import { env } from "../config/env";
import { getPaymentsApiPrefix } from "../helpers/payments-api-prefix";
import {
  CreateMolliePaymentInput,
  ReportType,
} from "../schemas/payments.schema";
import { MollieClientService, MolliePayment } from "./mollie-client.service";
import { InvoicesRepository } from "../repositories/invoices.repository";
import { ReportPaymentsRepository } from "../repositories/report-payments.repository";
import { SavedReportsRepository } from "../repositories/saved-reports.repository";

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

type CurrentUser = {
  userId: string;
  role: UserRole;
};

type CreateMollieCheckoutOptions = {
  userId?: string;
};

const REPORT_PRICES_CENTS: Record<ReportType, number> = {
  "property-report": 495,
  "last-sale-report": 999,
  "sold-home-benchmark-report": 999,
};

export class ReportPaymentsService {
  private readonly invoicesRepository: InvoicesRepository;
  private readonly reportPaymentsRepository: ReportPaymentsRepository;
  private readonly savedReportsRepository: SavedReportsRepository;
  private readonly mollieClient: MollieClientService;

  constructor(
    private readonly prisma: PrismaClient,
    mollieClient = new MollieClientService(),
  ) {
    this.invoicesRepository = new InvoicesRepository(prisma);
    this.reportPaymentsRepository = new ReportPaymentsRepository(prisma);
    this.savedReportsRepository = new SavedReportsRepository(prisma);
    this.mollieClient = mollieClient;
  }

  async createMollieCheckout(
    input: CreateMolliePaymentInput,
    options: CreateMollieCheckoutOptions = {},
  ): Promise<CreateCheckoutResult> {
    const checkoutToken = createCheckoutToken();
    const amountCents = REPORT_PRICES_CENTS[input.reportType];
    const userId =
      options.userId ?? (await this.getSavedReportOwnerId(input.reportId));
    const baseUrl = getPublicAppUrl();
    const paymentsApiPrefix = getPaymentsApiPrefix();
    const webhookUrl = `${baseUrl}${paymentsApiPrefix}/payments/mollie/webhook`;
    const provisionalRedirectUrl = buildMollieReturnUrl({
      baseUrl,
      paymentsApiPrefix,
      checkoutToken,
    });

    const metadata = {
      checkoutToken,
      reportType: input.reportType,
      reportId: input.reportId,
      userId: userId ?? null,
      address: input.address ?? null,
      returnTo: input.returnTo ?? null,
    };

    const molliePayment = await this.mollieClient.createPayment({
      amount: {
        currency: "EUR",
        value: formatEuroAmount(amountCents),
      },
      description: getPaymentDescription(input.reportType, input.reportId),
      redirectUrl: provisionalRedirectUrl,
      webhookUrl,
      metadata,
    });

    const redirectUrl = buildMollieReturnUrl({
      baseUrl,
      paymentsApiPrefix,
      paymentId: molliePayment.id,
      checkoutToken,
    });
    const updatedPayment = await this.mollieClient.updatePayment(
      molliePayment.id,
      {
        redirectUrl,
        webhookUrl,
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

    await this.reportPaymentsRepository.create({
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
    return syncedPayment?.status === "paid";
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

    return this.reportPaymentsRepository.updateByMolliePaymentId(
      molliePayment.id,
      {
        status,
        invoiceId,
        paidAt:
          status === "paid"
            ? parseMollieDate(molliePayment.paidAt) ?? new Date()
            : null,
        metadata: toJsonValue(molliePayment.metadata ?? {}),
      },
    );
  }

  private async ensureInvoiceForPayment(payment: ReportPayment) {
    if (!payment.userId) {
      return payment.invoiceId ?? undefined;
    }

    if (payment.invoiceId) {
      return payment.invoiceId;
    }

    const existingInvoice = await this.invoicesRepository.findByProviderPayment(
      "mollie",
      payment.molliePaymentId,
    );

    if (existingInvoice) {
      return existingInvoice.id;
    }

    const invoice = await this.invoicesRepository.create({
      userId: payment.userId,
      number: createInvoiceNumber(payment.molliePaymentId),
      description: getInvoiceDescription(payment),
      amountCents: payment.amountCents,
      currency: payment.currency,
      status: InvoiceStatus.PAID,
      provider: "mollie",
      providerId: payment.molliePaymentId,
    });

    return invoice.id;
  }

  private async getSavedReportOwnerId(reportId: string) {
    const savedReport = await this.savedReportsRepository.findById(reportId);
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
  baseUrl,
  paymentsApiPrefix = getPaymentsApiPrefix(),
  paymentId,
  checkoutToken,
}: {
  baseUrl: string;
  paymentsApiPrefix?: string;
  paymentId?: string;
  checkoutToken: string;
}) {
  const url = new URL(`${baseUrl}${paymentsApiPrefix}/payments/mollie/return`);

  if (paymentId) {
    url.searchParams.set("paymentId", paymentId);
  }

  url.searchParams.set("checkoutToken", checkoutToken);
  return url.toString();
}

function buildPaidReportUrl(payment: ReportPayment) {
  return buildReportUrl({
    reportType: payment.reportType as ReportType,
    reportId: payment.reportId,
    paymentState: "paid",
    paymentId: payment.molliePaymentId,
    checkoutToken: payment.checkoutToken,
  });
}

function buildFallbackReportUrl({
  reportType,
  reportId,
  paymentState,
  paymentId,
  checkoutToken,
}: {
  reportType: ReportType;
  reportId: string;
  paymentState: "cancelled" | "failed";
  paymentId?: string;
  checkoutToken?: string;
}) {
  return buildReportUrl({
    reportType,
    reportId,
    paymentState,
    paymentId,
    checkoutToken,
  });
}

function buildReportUrl({
  reportType,
  reportId,
  paymentState,
  paymentId,
  checkoutToken,
}: {
  reportType: ReportType;
  reportId: string;
  paymentState: "paid" | "cancelled" | "failed";
  paymentId?: string;
  checkoutToken?: string;
}) {
  const baseUrl = getPublicAppUrl();
  const path = getReportPath(reportType, reportId);
  const url = new URL(path, baseUrl);

  url.searchParams.set("payment", paymentState);

  if (paymentId) {
    url.searchParams.set("paymentId", paymentId);
  }

  if (checkoutToken) {
    url.searchParams.set("checkoutToken", checkoutToken);
  }

  return url.toString();
}

function getReportPath(reportType: ReportType, reportId: string) {
  switch (reportType) {
    case "property-report":
      return `/report/${encodeURIComponent(reportId)}`;
    case "last-sale-report":
      return `/last-sale-report?id=${encodeURIComponent(reportId)}`;
    case "sold-home-benchmark-report":
      return `/sold-home-benchmark-report?id=${encodeURIComponent(reportId)}`;
  }
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

function formatEuroAmount(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}

function normalizeMollieStatus(status: string) {
  return status === "canceled" ? "cancelled" : status;
}

function createCheckoutToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getPublicAppUrl() {
  return (env.PUBLIC_APP_URL || env.FRONTEND_URL).replace(/\/$/, "");
}

function parseMollieDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toJsonValue(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function toPublicReportPayment(payment: ReportPayment) {
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
    paidAt: payment.paidAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}
