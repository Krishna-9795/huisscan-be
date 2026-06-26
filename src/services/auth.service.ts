import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";

import { comparePassword, hashPassword } from "../helpers/password";
import { getTokenExpiryDate, signAuthToken } from "../helpers/jwt";
import { LoginInput, RegisterInput } from "../schemas/auth.schema";
import { SessionsRepository } from "../repositories/sessions.repository";
import { UsersRepository, toPublicUser } from "../repositories/users.repository";

export class AuthService {
  private readonly usersRepository: UsersRepository;
  private readonly sessionsRepository: SessionsRepository;

  constructor(
    prisma: PrismaClient,
    private readonly app: FastifyInstance,
  ) {
    this.usersRepository = new UsersRepository(prisma);
    this.sessionsRepository = new SessionsRepository(prisma);
  }

  async register(input: RegisterInput) {
    const email = input.email.toLowerCase();
    const existingUser = await this.usersRepository.findByEmail(email);

    if (existingUser) {
      throw this.app.httpErrors.conflict("Email is already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.usersRepository.create({
      email,
      name: input.name,
      passwordHash,
    });
    const token = signAuthToken(this.app, {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await this.sessionsRepository.create(
      user.id,
      token,
      getTokenExpiryDate(),
    );

    return {
      user: toPublicUser(user),
      token,
    };
  }

  async login(input: LoginInput) {
    const user = await this.usersRepository.findByEmail(
      input.email.toLowerCase(),
    );

    if (!user || !user.passwordHash) {
      throw this.app.httpErrors.unauthorized("Invalid email or password");
    }

    const passwordMatches = await comparePassword(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw this.app.httpErrors.unauthorized("Invalid email or password");
    }

    const token = signAuthToken(this.app, {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    await this.sessionsRepository.create(
      user.id,
      token,
      getTokenExpiryDate(),
    );

    return {
      user: toPublicUser(user),
      token,
    };
  }

  async logout(sessionToken: string) {
    await this.sessionsRepository.deleteByToken(sessionToken);
  }
}
