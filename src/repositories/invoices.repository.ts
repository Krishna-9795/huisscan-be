import { Invoice, InvoiceStatus, PrismaClient } from "@prisma/client";

type CreateInvoiceData = {
  userId: string;
  number: string;
  description: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  provider: string;
  providerId: string;
};

export class InvoicesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findAllByUserId(userId: string) {
    return this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  findAll() {
    return this.prisma.invoice.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  findById(id: string) {
    return this.prisma.invoice.findUnique({
      where: { id },
    });
  }

  findByProviderPayment(provider: string, providerId: string) {
    return this.prisma.invoice.findFirst({
      where: {
        provider,
        providerId,
      },
    });
  }

  create(data: CreateInvoiceData) {
    return this.prisma.invoice.create({
      data,
    });
  }
}

export function toPublicInvoice(invoice: Invoice) {
  return {
    id: invoice.id,
    userId: invoice.userId,
    number: invoice.number,
    description: invoice.description,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    status: invoice.status,
    provider: invoice.provider,
    providerId: invoice.providerId,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}
