import { PrismaClient, UserReportArtifact } from "@prisma/client";

type UpsertUserReportArtifactData = {
  userId: number;
  reportPaymentId: number;
  artifactType: string;
  storageKey?: string;
  publicUrl?: string;
  fileName?: string;
  status: string;
};

export class UserReportArtifactsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findLatestPaidPaymentForReport(input: {
    userId: number;
    reportType: string;
    reportId: string;
  }) {
    return this.prisma.reportPayment.findFirst({
      where: {
        userId: input.userId,
        reportType: input.reportType,
        reportId: input.reportId,
        status: "paid",
      },
      orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
    });
  }

  upsertForPayment(data: UpsertUserReportArtifactData) {
    return this.prisma.userReportArtifact.upsert({
      where: {
        reportPaymentId_artifactType: {
          reportPaymentId: data.reportPaymentId,
          artifactType: data.artifactType,
        },
      },
      update: {
        storageKey: data.storageKey,
        publicUrl: data.publicUrl,
        fileName: data.fileName,
        status: data.status,
      },
      create: data,
    });
  }
}

export function toPublicUserReportArtifact(artifact: UserReportArtifact) {
  return {
    id: artifact.id,
    userId: artifact.userId,
    reportPaymentId: artifact.reportPaymentId,
    artifactType: artifact.artifactType,
    storageKey: artifact.storageKey,
    publicUrl: artifact.publicUrl,
    fileName: artifact.fileName,
    status: artifact.status,
    createdAt: artifact.createdAt,
    updatedAt: artifact.updatedAt,
  };
}
