import { PrismaClient, UserRole } from "@prisma/client";

import {
  InvoicesRepository,
  toPublicInvoice,
} from "../repositories/invoices.repository";

type CurrentUser = {
  userId: number;
  role: UserRole;
};

export class InvoicesService {
  private readonly invoicesRepository: InvoicesRepository;

  constructor(prisma: PrismaClient) {
    this.invoicesRepository = new InvoicesRepository(prisma);
  }

  async getAllForUser(userId: number, currentUser: CurrentUser) {
    if (!canAccessUserResource(currentUser, userId)) {
      return null;
    }

    const invoices = await this.invoicesRepository.findAllByUserId(userId);

    return invoices.map(toPublicInvoice);
  }

  async getById(id: number, userId: number, currentUser: CurrentUser) {
    if (!canAccessUserResource(currentUser, userId)) {
      return {
        status: "forbidden" as const,
      };
    }

    const invoice = await this.invoicesRepository.findById(id);

    if (!invoice) {
      return {
        status: "not_found" as const,
      };
    }

    if (invoice.userId !== userId) {
      return {
        status: "forbidden" as const,
      };
    }

    return {
      status: "ok" as const,
      invoice: toPublicInvoice(invoice),
    };
  }
}

function canAccessUserResource(currentUser: CurrentUser, resourceUserId: number) {
  return currentUser.role === "ADMIN" || currentUser.userId === resourceUserId;
}
