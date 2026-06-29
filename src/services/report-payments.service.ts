import crypto from "crypto";

import { Prisma, PrismaClient, ReportPayment } from "@prisma/client";

import { env } from "../config/env";
import {
  CreateMolliePaymentInput,
  ReportType,
} from "../schemas/payments.schema";
import { MollieClientService, MolliePayment } from "./mollie-client.service";
import { ReportPaymentsRepository } from "../repositories/report-payments.repository";

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

const REPORT_PRICES_CENTS: Record<ReportType, number> = {
  "property-report": 495,
  "last-sale-report": 999,
  "sold-home-benchmark-report": 999,
};

export class ReportPaymentsService {
  private readonly reportPaymentsRepository: ReportPaymentsRepository;
  private readonly mollieClient: MollieClientService;

  constructor(
    prisma: PrismaClient,
    mollieClient = new MollieClientService(),
  ) {
    this.reportPaymentsRepository = new ReportPaymentsRepository(prisma);
    this.mollieClient = mollieClient;
  }

  async createMollieCheckout(
    input: CreateMolliePaymentInput,
  ): Promise<CreateCheckoutResult> {
    const checkoutToken = createCheckoutToken();
    const amountCents = REPORT_PRICES_CENTS[input.reportType];
    const baseUrl = getPublicAppUrl();
    const webhookUrl = `${baseUrl}${env.API_PREFIX}/payments/mollie/webhook`;
    const provisionalRedirectUrl = buildMollieReturnUrl({
      baseUrl,
      checkoutToken,
    });

    const metadata = {
      checkoutToken,
      reportType: input.reportType,
      reportId: input.reportId,
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

  private async updateStoredPaymentFromMollie(molliePayment: MolliePayment) {
    const storedPayment =
      await this.reportPaymentsRepository.findByMolliePaymentId(
        molliePayment.id,
      );

    if (!storedPayment) {
      return null;
    }

    const status = normalizeMollieStatus(molliePayment.status);
    return this.reportPaymentsRepository.updateByMolliePaymentId(
      molliePayment.id,
      {
        status,
        paidAt:
          status === "paid"
            ? parseMollieDate(molliePayment.paidAt) ?? new Date()
            : null,
        metadata: toJsonValue(molliePayment.metadata ?? {}),
      },
    );
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
  paymentId,
  checkoutToken,
}: {
  baseUrl: string;
  paymentId?: string;
  checkoutToken: string;
}) {
  const url = new URL(`${baseUrl}${env.API_PREFIX}/payments/mollie/return`);

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
