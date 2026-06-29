import { FastifyReply, FastifyRequest } from "fastify";

import { ReportType, reportTypeSchema } from "../schemas/payments.schema";
import { hasPaidReportAccess } from "../services/report-payments.service";

type PaidReportAccessOptions = {
  reportType: ReportType;
  getReportId?: (request: FastifyRequest) => string | undefined;
};

export function paidReportAccessMiddleware({
  reportType,
  getReportId = getReportIdFromRequest,
}: PaidReportAccessOptions) {
  reportTypeSchema.parse(reportType);

  return async function requirePaidReportAccess(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const reportId = getReportId(request);
    const paymentId = getQueryString(request, "paymentId");
    const checkoutToken = getQueryString(request, "checkoutToken");

    if (!reportId || !paymentId || !checkoutToken) {
      return reply.status(402).send({
        success: false,
        message: "Paid report access requires a valid payment",
      });
    }

    const isAllowed = await hasPaidReportAccess(request.server.prisma, {
      reportType,
      reportId,
      paymentId,
      checkoutToken,
    });

    if (!isAllowed) {
      return reply.status(402).send({
        success: false,
        message: "Paid report access requires a completed payment",
      });
    }
  };
}

function getReportIdFromRequest(request: FastifyRequest) {
  return getQueryString(request, "reportId") || getQueryString(request, "id");
}

function getQueryString(request: FastifyRequest, key: string) {
  if (!request.query || typeof request.query !== "object") {
    return undefined;
  }

  const value = (request.query as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
