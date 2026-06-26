import { z } from "zod";

export const invoiceIdParamsSchema = z.object({
  id: z.string().cuid(),
});

export type InvoiceIdParams = z.infer<typeof invoiceIdParamsSchema>;
