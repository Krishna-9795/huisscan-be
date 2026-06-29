import { PrismaClient } from "@prisma/client";

export class SessionsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(userId: number, sessionToken: string, expiresAt: Date) {
    return this.prisma.session.create({
      data: {
        userId,
        sessionToken,
        expiresAt,
      },
    });
  }

  findByToken(sessionToken: string) {
    return this.prisma.session.findUnique({
      where: { sessionToken },
    });
  }

  deleteByToken(sessionToken: string) {
    return this.prisma.session.deleteMany({
      where: { sessionToken },
    });
  }
}
