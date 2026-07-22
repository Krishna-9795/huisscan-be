import { Invoice, PrismaClient } from "@prisma/client";

import { generateInvoicePdf } from "../helpers/invoice-pdf";
import { InvoicesRepository } from "../repositories/invoices.repository";
import { UploadsService } from "./uploads.service";

export class InvoicePdfService {
  private readonly invoicesRepository: InvoicesRepository;

  constructor(
    prisma: PrismaClient,
    private readonly uploadsServiceFactory = () => new UploadsService(),
  ) {
    this.invoicesRepository = new InvoicesRepository(prisma);
  }

  async ensurePdfForInvoice(invoice: Invoice) {
    if (invoice.pdfUrl && invoice.pdfStorageKey) {
      return invoice;
    }

    const uploadsService = this.uploadsServiceFactory();
    const filename = `${invoice.number}.pdf`;
    const pdfBuffer = generateInvoicePdf({
      number: invoice.number,
      description: invoice.description,
      amountCents: invoice.amountCents,
      subtotalAmountCents: invoice.subtotalAmountCents,
      vatAmountCents: invoice.vatAmountCents,
      totalAmountCents: invoice.totalAmountCents,
      currency: invoice.currency,
      vatType: invoice.vatType,
      vatRateBps: invoice.vatRateBps,
      vatSlabName: invoice.vatSlabName,
      status: invoice.status,
      provider: invoice.provider,
      providerId: invoice.providerId,
      issuedAt: invoice.createdAt,
    });
    const uploadedFile = await uploadsService.uploadFile({
      buffer: pdfBuffer,
      filename,
      mimetype: "application/pdf",
      key: createInvoicePdfStorageKey(invoice.number),
    });

    return this.invoicesRepository.updatePdfStorage(invoice.id, {
      pdfUrl: uploadedFile.publicUrl,
      pdfStorageKey: uploadedFile.key,
    });
  }
}

function createInvoicePdfStorageKey(invoiceNumber: string) {
  const safeInvoiceNumber = invoiceNumber
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `invoices/${safeInvoiceNumber || "invoice"}.pdf`;
}
