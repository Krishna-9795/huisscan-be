import { FastifyReply, FastifyRequest } from "fastify";

import { getBearerToken } from "../helpers/jwt";
import { SessionsRepository } from "../repositories/sessions.repository";

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    await request.jwtVerify();

    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      return reply.status(401).send({
        success: false,
        message: "Unauthorized",
      });
    }

    const sessionsRepository = new SessionsRepository(request.server.prisma);
    const session = await sessionsRepository.findByToken(token);

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({
        success: false,
        message: "Unauthorized",
      });
    }
  } catch {
    return reply.status(401).send({
      success: false,
      message: "Unauthorized",
    });
  }
}
