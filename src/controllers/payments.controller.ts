import { FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

import {
  createMolliePaymentSchema,
  mollieReturnQuerySchema,
  mollieWebhookBodySchema,
} from "../schemas/payments.schema";
import { MollieApiError } from "../services/mollie-client.service";
import { ReportPaymentsService } from "../services/report-payments.service";

export async function createMolliePayment(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  request.log.info(
    {
      method: request.method,
      contentType: request.headers["content-type"] ?? null,
    },
    "Mollie payment create request received",
  );

  const rawBody = normalizePaymentBody(request.body);
  const parsedBody = createMolliePaymentSchema.safeParse(rawBody);

  request.log.info(
    {
      reportType: rawBody.reportType ?? null,
      reportId: rawBody.reportId ?? null,
      address: rawBody.address ?? null,
    },
    "Mollie payment create request parsed",
  );

  if (!parsedBody.success) {
    return reply.status(400).send({
      success: false,
      message: "Invalid payment request",
      errors: parsedBody.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  const body = parsedBody.data;
  const reportPaymentsService = new ReportPaymentsService(request.server.prisma);

  try {
    request.log.info(
      {
        reportType: body.reportType,
        reportId: body.reportId,
        address: body.address ?? null,
      },
      "Mollie checkout creation starting",
    );

    const checkout = await reportPaymentsService.createMollieCheckout(body);

    if (wantsJson(request)) {
      return reply.send({
        success: true,
        checkoutUrl: checkout.checkoutUrl,
        paymentId: checkout.paymentId,
        checkoutToken: checkout.checkoutToken,
      });
    }

    return reply.redirect(checkout.checkoutUrl, 303);
  } catch (error) {
    if (error instanceof MollieApiError) {
      request.log.error(
        { errorMessage: error.message },
        "Mollie checkout creation failed",
      );

      return reply.status(502).send({
        success: false,
        message: error.message,
      });
    }

    if (
      error instanceof Error &&
      error.message.includes("MOLLIE_API_KEY or MOLLIE_TEST_API_KEY")
    ) {
      request.log.error(
        { errorMessage: error.message },
        "Mollie checkout creation failed",
      );

      return reply.status(500).send({
        success: false,
        message: error.message,
      });
    }

    throw error;
  }
}

export async function handleMollieReturn(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = mollieReturnQuerySchema.parse(request.query);
  const reportPaymentsService = new ReportPaymentsService(request.server.prisma);
  const result = await reportPaymentsService.handleReturn(query);

  return reply.redirect(result.redirectUrl, 303);
}

export async function handleMollieWebhook(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const body = mollieWebhookBodySchema.parse(request.body);
    const reportPaymentsService = new ReportPaymentsService(request.server.prisma);
    await reportPaymentsService.syncPaymentStatusById(body.id);
  } catch (error) {
    if (error instanceof ZodError) {
      request.log.warn({ error }, "Invalid Mollie webhook payload");
    } else {
      request.log.error({ error }, "Failed to process Mollie webhook");
    }
  }

  return reply.status(200).send({ success: true });
}

function wantsJson(request: FastifyRequest) {
  const accept = request.headers.accept ?? "";
  return accept.includes("application/json");
}

function normalizePaymentBody(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(body as Record<string, unknown>).map(([key, value]) => [
      key,
      getFormValue(value),
    ]),
  );
}

function getFormValue(value: unknown) {
  if (Array.isArray(value)) {
    return getFormValue(value[0]);
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return value;
}
