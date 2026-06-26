import { FastifyReply, FastifyRequest } from "fastify";

export async function adminMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  if (request.user.role !== "ADMIN") {
    return reply.status(403).send({
      success: false,
      message: "Admin access required",
    });
  }
}
