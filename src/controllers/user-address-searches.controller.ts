import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import {
  addressAccessQuerySchema,
  recordAddressSearchSchema,
} from "../schemas/user-address-searches.schema";
import { UserAddressSearchesService } from "../services/user-address-searches.service";

export async function recordAddressSearch(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = recordAddressSearchSchema.parse(request.body);
  const userAddressSearchesService = new UserAddressSearchesService(
    request.server.prisma,
  );
  const search = await userAddressSearchesService.recordSearch({
    userId: request.user.userId,
    reportType: body.reportType,
    reportId: body.reportId,
    address: body.address,
    paymentStatus: "unpaid",
  });

  return reply.status(201).send(successResponse({ search }));
}

export async function checkAddressAccess(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = addressAccessQuerySchema.parse(request.query);
  const userAddressSearchesService = new UserAddressSearchesService(
    request.server.prisma,
  );
  const access = await userAddressSearchesService.checkAccess({
    userId: request.user.userId,
    reportType: query.reportType,
    address: query.address,
  });

  return reply.send(successResponse(access));
}

export async function getAddressSearches(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const userAddressSearchesService = new UserAddressSearchesService(
    request.server.prisma,
  );
  const searches = await userAddressSearchesService.getAllForUser(
    request.user.userId,
  );

  return reply.send(successResponse({ searches }));
}
