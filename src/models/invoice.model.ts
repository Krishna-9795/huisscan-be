import { InvoiceStatus } from "@prisma/client";

export type PublicInvoice = {
  id: number;
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
  vatSlabId: number | null;
  vatSlabCode: string | null;
  vatSlabName: string | null;
  status: InvoiceStatus;
  provider: string | null;
  providerId: string | null;
  pdfUrl: string | null;
  pdfStorageKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};
