import { PrismaClient, UserRole } from "@prisma/client";

import {
  SavedReportsRepository,
  toPublicSavedReport,
} from "../repositories/saved-reports.repository";
import { CreateSavedReportInput } from "../schemas/saved-reports.schema";

type CurrentUser = {
  userId: number;
  role: UserRole;
};

export class SavedReportsService {
  private readonly savedReportsRepository: SavedReportsRepository;

  constructor(prisma: PrismaClient) {
    this.savedReportsRepository = new SavedReportsRepository(prisma);
  }

  async create(userId: number, input: CreateSavedReportInput) {
    const savedReport = await this.savedReportsRepository.create({
      userId,
      propertyId: input.propertyId,
      address: input.address,
      reportData: input.reportData,
    });

    return toPublicSavedReport(savedReport);
  }

  async getAllForUser(currentUser: CurrentUser) {
    const savedReports =
      currentUser.role === "ADMIN"
        ? await this.savedReportsRepository.findAll()
        : await this.savedReportsRepository.findAllByUserId(currentUser.userId);

    return savedReports.map(toPublicSavedReport);
  }

  async getById(id: number, currentUser: CurrentUser) {
    const savedReport = await this.savedReportsRepository.findById(id);

    if (!savedReport || !canAccessUserResource(currentUser, savedReport.userId)) {
      return null;
    }

    return toPublicSavedReport(savedReport);
  }

  async deleteById(id: number, currentUser: CurrentUser) {
    const savedReport = await this.savedReportsRepository.findById(id);

    if (!savedReport || !canAccessUserResource(currentUser, savedReport.userId)) {
      return false;
    }

    await this.savedReportsRepository.deleteById(id);
    return true;
  }
}

function canAccessUserResource(currentUser: CurrentUser, resourceUserId: number) {
  return currentUser.role === "ADMIN" || currentUser.userId === resourceUserId;
}
