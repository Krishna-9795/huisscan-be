import { Prisma, PrismaClient, SavedReport } from "@prisma/client";

type CreateSavedReportData = {
  userId: string;
  propertyId: string;
  address: string;
  reportData: Prisma.InputJsonValue;
};

export class SavedReportsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: CreateSavedReportData) {
    return this.prisma.savedReport.upsert({
      where: {
        userId_propertyId: {
          userId: data.userId,
          propertyId: data.propertyId,
        },
      },
      update: {
        address: data.address,
        reportData: data.reportData,
      },
      create: data,
    });
  }

  findAllByUserId(userId: string) {
    return this.prisma.savedReport.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  findAll() {
    return this.prisma.savedReport.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.savedReport.findUnique({
      where: { id },
    });
  }

  deleteById(id: string) {
    return this.prisma.savedReport.delete({
      where: { id },
    });
  }
}

export function toPublicSavedReport(savedReport: SavedReport) {
  return {
    id: savedReport.id,
    userId: savedReport.userId,
    propertyId: savedReport.propertyId,
    address: savedReport.address,
    reportData: savedReport.reportData,
    createdAt: savedReport.createdAt,
    updatedAt: savedReport.updatedAt,
  };
}
