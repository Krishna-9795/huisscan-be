import { InvoiceStatus } from "@prisma/client";

export type PublicInvoice = {
  id: number;
  userId: number;
  number: string;
  description: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  provider: string | null;
  providerId: string | null;
  createdAt: Date;
  updatedAt: Date;
};
