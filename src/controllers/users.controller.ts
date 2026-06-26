import { FastifyReply, FastifyRequest } from "fastify";

import { successResponse } from "../helpers/response";
import { UsersService } from "../services/users.service";
import {
  createUserProfileSchema,
  updateUserSchema,
  userIdParamsSchema,
} from "../schemas/users.schema";

export async function createUserProfile(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const body = createUserProfileSchema.parse(request.body);
  const usersService = new UsersService(request.server.prisma);
  const user = await usersService.createUserProfile(body);

  if (!user) {
    throw request.server.httpErrors.conflict(
      "A user with this email already exists",
    );
  }

  return reply
    .status(201)
    .send(successResponse(user, "User profile created successfully"));
}

export async function getMe(request: FastifyRequest, reply: FastifyReply) {
  const usersService = new UsersService(request.server.prisma);
  const user = await usersService.getUserById(request.user.userId);

  if (!user) {
    throw request.server.httpErrors.notFound("User not found");
  }

  return reply.send(successResponse(user));
}

export async function updateMe(request: FastifyRequest, reply: FastifyReply) {
  const body = updateUserSchema.parse(request.body);
  const usersService = new UsersService(request.server.prisma);
  const user = await usersService.updateCurrentUser(request.user.userId, body);

  return reply.send(successResponse(user, "User updated successfully"));
}

export async function getUsers(request: FastifyRequest, reply: FastifyReply) {
  const usersService = new UsersService(request.server.prisma);
  const users = await usersService.getAllUsers();

  return reply.send(successResponse(users));
}

export async function getUserById(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const { id } = userIdParamsSchema.parse(request.params);
  const usersService = new UsersService(request.server.prisma);
  const user = await usersService.getUserById(id);

  if (!user) {
    throw request.server.httpErrors.notFound("User not found");
  }

  return reply.send(successResponse(user));
}
