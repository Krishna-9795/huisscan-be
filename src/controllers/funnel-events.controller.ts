import { FastifyReply, FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";

import { getBearerToken } from "../helpers/jwt";
import { successResponse } from "../helpers/response";
import {
  createFunnelEventSchema,
  funnelEventsQuerySchema,
} from "../schemas/funnel-events.schema";
import { FunnelEventsService } from "../services/funnel-events.service";

export async function createFunnelEvent(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = createFunnelEventSchema.parse(request.body);
  const funnelEventsService = new FunnelEventsService(request.server.prisma);
  const event = await funnelEventsService.create({
    eventName: body.eventName,
    sessionId: body.sessionId,
    userId: getUserIdFromOptionalBearer(request),
    reportType: body.reportType,
    reportId: body.reportId,
    address: body.address,
    query: body.query,
    suggestionId: body.suggestionId,
    paymentId: body.paymentId,
    checkoutToken: body.checkoutToken,
    amountCents: body.amountCents,
    currency: body.currency,
    metadata: body.metadata as Prisma.InputJsonValue | undefined,
    userAgent: request.headers["user-agent"],
    referer: request.headers.referer,
  });

  return reply.status(201).send(successResponse({ event }));
}

export async function getFunnelEvents(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = funnelEventsQuerySchema.parse(request.query);
  const funnelEventsService = new FunnelEventsService(request.server.prisma);
  const events = await funnelEventsService.getLatest(query);

  return reply.send(successResponse({ events }));
}

function getUserIdFromOptionalBearer(request: FastifyRequest) {
  const token = getBearerToken(request.headers.authorization);

  if (!token) {
    return undefined;
  }

  try {
    return request.server.jwt.verify<{ userId: number }>(token).userId;
  } catch {
    return undefined;
  }
}
