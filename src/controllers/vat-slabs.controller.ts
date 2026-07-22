import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import {
  createVatSlabBodySchema,
  updateVatSlabBodySchema,
  vatSlabIdParamsSchema,
} from "../schemas/vat-slabs.schema";
import { VatSlabsService } from "../services/vat-slabs.service";

export async function getVatSlabs(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const vatSlabsService = new VatSlabsService(request.server.prisma);
  const slabs = await vatSlabsService.getAll();

  return reply.send(successResponse({ slabs }));
}

export async function createVatSlab(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = createVatSlabBodySchema.parse(request.body);
  const vatSlabsService = new VatSlabsService(request.server.prisma);
  const result = await vatSlabsService.create(body);

  if (result.status === "conflict") {
    throw request.server.httpErrors.conflict("A VAT slab with this code exists");
  }

  return reply.status(201).send(successResponse({ slab: result.slab }));
}

export async function updateVatSlab(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = vatSlabIdParamsSchema.parse(request.params);
  const body = updateVatSlabBodySchema.parse(request.body);
  const vatSlabsService = new VatSlabsService(request.server.prisma);
  const result = await vatSlabsService.update(id, body);

  if (result.status === "not_found") {
    throw request.server.httpErrors.notFound("VAT slab not found");
  }

  if (result.status === "conflict") {
    throw request.server.httpErrors.conflict("A VAT slab with this code exists");
  }

  return reply.send(successResponse({ slab: result.slab }));
}
