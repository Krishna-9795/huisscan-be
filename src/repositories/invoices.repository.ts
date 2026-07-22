import { Invoice, InvoiceStatus, Prisma, PrismaClient } from "@prisma/client";

type CreateInvoiceData = {
  userId: number;
  number: string;
  description: string;
  amountCents: number;
  subtotalAmountCents: number;
  vatAmountCents: number;
  totalAmountCents: number;
  currency: string;
  vatType: "ZERO" | "INCLUSIVE" | "EXCLUSIVE";
  vatRateBps: number;
  vatSlabId?: number | null;
  vatSlabCode?: string | null;
  vatSlabName?: string | null;
  status: InvoiceStatus;
  provider: string;
  providerId: string;
};

type InvoicePdfStorageData = {
  pdfUrl: string;
  pdfStorageKey: string;
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

  updatePdfStorage(id: number, data: InvoicePdfStorageData) {
    return this.prisma.invoice.update({
      where: { id },
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
    subtotalAmountCents: invoice.subtotalAmountCents,
    vatAmountCents: invoice.vatAmountCents,
    totalAmountCents: invoice.totalAmountCents,
    currency: invoice.currency,
    vatType: invoice.vatType,
    vatRateBps: invoice.vatRateBps,
    vatSlabId: invoice.vatSlabId,
    vatSlabCode: invoice.vatSlabCode,
    vatSlabName: invoice.vatSlabName,
    status: invoice.status,
    provider: invoice.provider,
    providerId: invoice.providerId,
    pdfUrl: invoice.pdfUrl,
    pdfStorageKey: invoice.pdfStorageKey,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}
