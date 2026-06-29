import "@fastify/jwt";
import { PrismaClient, UserRole } from "@prisma/client";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      userId: number;
      email: string;
      role: UserRole;
    };
    user: {
      userId: number;
      email: string;
      role: UserRole;
    };
  }
}
