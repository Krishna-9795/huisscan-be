import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import { addressAccessQuerySchema } from "../schemas/user-address-searches.schema";
import { UserAddressSearchesService } from "../services/user-address-searches.service";

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
