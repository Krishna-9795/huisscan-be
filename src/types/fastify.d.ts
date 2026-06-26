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
      userId: string;
      email: string;
      role: UserRole;
    };
    user: {
      userId: string;
      email: string;
      role: UserRole;
    };
  }
}
