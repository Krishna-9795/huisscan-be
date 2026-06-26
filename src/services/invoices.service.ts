import { PrismaClient, UserRole } from "@prisma/client";

import {
  InvoicesRepository,
  toPublicInvoice,
} from "../repositories/invoices.repository";

type CurrentUser = {
  userId: string;
  role: UserRole;
};

export class InvoicesService {
  private readonly invoicesRepository: InvoicesRepository;

  constructor(prisma: PrismaClient) {
    this.invoicesRepository = new InvoicesRepository(prisma);
  }

  async getAllForUser(currentUser: CurrentUser) {
    const invoices =
      currentUser.role === "ADMIN"
        ? await this.invoicesRepository.findAll()
        : await this.invoicesRepository.findAllByUserId(currentUser.userId);

    return invoices.map(toPublicInvoice);
  }

  async getById(id: string, currentUser: CurrentUser) {
    const invoice = await this.invoicesRepository.findById(id);

    if (!invoice || !canAccessUserResource(currentUser, invoice.userId)) {
      return null;
    }

    return toPublicInvoice(invoice);
  }
}

function canAccessUserResource(currentUser: CurrentUser, resourceUserId: string) {
  return currentUser.role === "ADMIN" || currentUser.userId === resourceUserId;
}
