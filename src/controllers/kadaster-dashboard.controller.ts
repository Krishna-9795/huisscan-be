import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import { kadasterDashboardQuerySchema } from "../schemas/kadaster-dashboard.schema";
import { KadasterDashboardCacheService } from "../services/kadaster-dashboard-cache.service";

export async function getKadasterDashboard(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { address } = kadasterDashboardQuerySchema.parse(request.query);
  const cacheService = new KadasterDashboardCacheService();
  const cachedDashboard = await cacheService.getCachedDashboard(address);

  if (!cachedDashboard) {
    const policy = cacheService.getAccessPolicy(address);

    reply.header("x-huisvalue-kadaster-live-enabled", String(policy.liveCallsEnabled));
    reply.header("x-huisvalue-kadaster-address-mode", policy.allowedAddressMode);

    if (!policy.addressAllowed) {
      throw request.server.httpErrors.forbidden(
        `Cached Kadaster dashboard is not available and this address is not allowed for live Kadaster calls. ${policy.reason}`,
      );
    }

    if (!policy.liveCallsEnabled) {
      throw request.server.httpErrors.notFound(
        `Cached Kadaster dashboard is not available. ${policy.reason}`,
      );
    }

    throw request.server.httpErrors.notImplemented(
      "Live Kadaster fallback is enabled by env and the address is allowed, but the live dashboard builder has not been ported into huiscan-be yet.",
    );
  }

  reply.header("x-huisvalue-kadaster-source", cachedDashboard.source);
  reply.header("x-huisvalue-kadaster-cache-key", cachedDashboard.cacheKey);
  reply.header("x-huisvalue-kadaster-migrated-to-redis", String(cachedDashboard.migratedToRedis));
  reply.header("x-huisvalue-kadaster-live-enabled", String(cacheService.getAccessPolicy(address).liveCallsEnabled));

  if (cachedDashboard.stale) {
    reply.header("x-huisvalue-kadaster-cache-stale", "true");
  }

  return reply.send(
    successResponse(cachedDashboard.data, "Cached Kadaster dashboard loaded"),
  );
}
