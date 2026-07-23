import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import {
  createAdminUserSchema,
  updateAdminPasswordSchema,
  updateAdminUserSchema,
  userIdParamsSchema,
} from "../schemas/users.schema";
import { UsersService } from "../services/users.service";

export async function getAdmins(request: FastifyRequest, reply: FastifyReply) {
  const usersService = new UsersService(request.server.prisma);
  const admins = await usersService.getAllAdmins();

  return reply.send(successResponse(admins));
}

export async function createAdmin(request: FastifyRequest, reply: FastifyReply) {
  const body = createAdminUserSchema.parse(request.body);
  const usersService = new UsersService(request.server.prisma);
  const admin = await usersService.createAdmin(body);

  if (!admin) {
    throw request.server.httpErrors.conflict(
      "A user with this email already exists",
    );
  }

  return reply
    .status(201)
    .send(successResponse(admin, "Admin created successfully"));
}

export async function getAdminById(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = userIdParamsSchema.parse(request.params);
  const usersService = new UsersService(request.server.prisma);
  const admin = await usersService.getAdminById(id);

  if (!admin) {
    throw request.server.httpErrors.notFound("Admin not found");
  }

  return reply.send(successResponse(admin));
}

export async function updateAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = userIdParamsSchema.parse(request.params);
  const body = updateAdminUserSchema.parse(request.body);
  const usersService = new UsersService(request.server.prisma);
  const result = await usersService.updateAdmin(id, body);

  if (result.status === "not-found") {
    throw request.server.httpErrors.notFound("Admin not found");
  }

  if (result.status === "email-conflict") {
    throw request.server.httpErrors.conflict(
      "A user with this email already exists",
    );
  }

  return reply.send(successResponse(result.user, "Admin updated successfully"));
}

export async function updateAdminPassword(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = userIdParamsSchema.parse(request.params);
  const body = updateAdminPasswordSchema.parse(request.body);
  const usersService = new UsersService(request.server.prisma);
  const admin = await usersService.updateAdminPassword(id, body);

  if (!admin) {
    throw request.server.httpErrors.notFound("Admin not found");
  }

  return reply.send(successResponse(admin, "Admin password updated successfully"));
}
