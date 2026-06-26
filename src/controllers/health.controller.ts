import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";

export async function getHealth(_request: FastifyRequest, reply: FastifyReply) {
  return reply.send(
    successResponse({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    }),
  );
}
