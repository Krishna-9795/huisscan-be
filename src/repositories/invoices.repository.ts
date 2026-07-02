import { Invoice, InvoiceStatus, Prisma, PrismaClient } from "@prisma/client";

type CreateInvoiceData = {
  userId: number;
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

  findAllByUserId(userId: number) {
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

  findById(id: number) {
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

  async createOnceByProviderPayment(data: CreateInvoiceData) {
    const existingInvoice = await this.findByProviderPayment(
      data.provider,
      data.providerId,
    );

    if (existingInvoice) {
      return existingInvoice;
    }

    try {
      return await this.create(data);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const invoice = await this.findByProviderPayment(
          data.provider,
          data.providerId,
        );

        if (invoice) {
          return invoice;
        }
      }

      throw error;
    }
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
