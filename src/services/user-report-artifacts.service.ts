import { UserRole } from "@prisma/client";

import {
  toPublicUserReportArtifact,
  UserReportArtifactsRepository,
} from "../repositories/user-report-artifacts.repository";
import { CreateUserReportArtifactInput } from "../schemas/user-report-artifacts.schema";

type CurrentUser = {
  userId: number;
  role: UserRole;
};

export class UserReportArtifactsService {
  private readonly userReportArtifactsRepository: UserReportArtifactsRepository;

  constructor(prisma: ConstructorParameters<typeof UserReportArtifactsRepository>[0]) {
    this.userReportArtifactsRepository = new UserReportArtifactsRepository(prisma);
  }

  async createForPaidReport(
    currentUser: CurrentUser,
    input: CreateUserReportArtifactInput,
  ) {
    const payment =
      await this.userReportArtifactsRepository.findLatestPaidPaymentForReport({
        userId: currentUser.userId,
        reportType: input.reportType,
        reportId: input.reportId,
      });

    if (!payment) {
      throw Object.assign(
        new Error("No paid report purchase was found for this user"),
        { statusCode: 404 },
      );
    }

    const artifact = await this.userReportArtifactsRepository.upsertForPayment({
      userId: currentUser.userId,
      reportPaymentId: payment.id,
      artifactType: input.artifactType,
      storageKey: input.storageKey,
      publicUrl: input.publicUrl,
      fileName: input.fileName,
      status: input.status,
    });

    return toPublicUserReportArtifact(artifact);
  }
}
