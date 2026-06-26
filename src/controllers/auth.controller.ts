import { FastifyReply, FastifyRequest } from "fastify";

import { getBearerToken } from "../helpers/jwt";
import { successResponse } from "../helpers/response";
import { AuthService } from "../services/auth.service";
import { loginSchema, registerSchema } from "../schemas/auth.schema";

export async function register(request: FastifyRequest, reply: FastifyReply) {
  const body = registerSchema.parse(request.body);
  const authService = new AuthService(request.server.prisma, request.server);
  const result = await authService.register(body);

  return reply
    .status(201)
    .send(successResponse(result, "User registered successfully"));
}

export async function login(request: FastifyRequest, reply: FastifyReply) {
  const body = loginSchema.parse(request.body);
  const authService = new AuthService(request.server.prisma, request.server);
  const result = await authService.login(body);

  return reply.send(successResponse(result, "Login successful"));
}

export async function logout(request: FastifyRequest, reply: FastifyReply) {
  const token = getBearerToken(request.headers.authorization);

  if (!token) {
    throw request.server.httpErrors.unauthorized("Unauthorized");
  }

  const authService = new AuthService(request.server.prisma, request.server);
  await authService.logout(token);

  return reply.send(successResponse(null, "Logout successful"));
}
