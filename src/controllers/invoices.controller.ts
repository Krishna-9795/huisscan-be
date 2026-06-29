import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import {
  invoiceIdParamsSchema,
  invoiceUserQuerySchema,
} from "../schemas/invoices.schema";
import { InvoicesService } from "../services/invoices.service";

export async function getInvoices(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { user_id: userId } = invoiceUserQuerySchema.parse(request.query);
  const invoicesService = new InvoicesService(request.server.prisma);
  const invoices = await invoicesService.getAllForUser(userId, request.user);

  if (!invoices) {
    throw request.server.httpErrors.forbidden(
      "You cannot access invoices for this user",
    );
  }

  return reply.send(successResponse({ invoices }));
}

export async function getInvoiceById(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = invoiceIdParamsSchema.parse(request.params);
  const { user_id: userId } = invoiceUserQuerySchema.parse(request.query);
  const invoicesService = new InvoicesService(request.server.prisma);
  const result = await invoicesService.getById(id, userId, request.user);

  if (result.status === "not_found") {
    throw request.server.httpErrors.notFound("Invoice not found");
  }

  if (result.status === "forbidden") {
    throw request.server.httpErrors.forbidden(
      "You cannot access invoices for this user",
    );
  }

  return reply.send(successResponse({ invoice: result.invoice }));
}
