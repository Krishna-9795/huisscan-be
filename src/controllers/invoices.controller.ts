import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import { invoiceIdParamsSchema } from "../schemas/invoices.schema";
import { InvoicesService } from "../services/invoices.service";

export async function getInvoices(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const invoicesService = new InvoicesService(request.server.prisma);
  const invoices = await invoicesService.getAllForUser(request.user);

  return reply.send(successResponse(invoices));
}

export async function getInvoiceById(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = invoiceIdParamsSchema.parse(request.params);
  const invoicesService = new InvoicesService(request.server.prisma);
  const invoice = await invoicesService.getById(id, request.user);

  if (!invoice) {
    throw request.server.httpErrors.notFound("Invoice not found");
  }

  return reply.send(successResponse(invoice));
}
