import { z } from "zod";

export const invoiceIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const invoiceUserQuerySchema = z.object({
  user_id: z.coerce.number({
    required_error: "user_id is required",
    invalid_type_error: "user_id must be a number",
  }).int().positive("user_id is required"),
});

export type InvoiceIdParams = z.infer<typeof invoiceIdParamsSchema>;
export type InvoiceUserQuery = z.infer<typeof invoiceUserQuerySchema>;
