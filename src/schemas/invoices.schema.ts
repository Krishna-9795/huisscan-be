import { z } from "zod";

export const invoiceIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type InvoiceIdParams = z.infer<typeof invoiceIdParamsSchema>;
