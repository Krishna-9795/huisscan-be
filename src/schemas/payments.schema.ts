import { z } from "zod";

export const reportTypeSchema = z.enum([
  "property-report",
  "last-sale-report",
  "sold-home-benchmark-report",
]);

export const createMolliePaymentSchema = z.object({
  reportType: reportTypeSchema,
  reportId: z.string().min(1, "reportId is required"),
  address: z.string().trim().optional(),
  returnTo: z.string().trim().optional(),
});

export const mollieReturnQuerySchema = z.object({
  paymentId: z.string().min(1, "paymentId is required").optional(),
  checkoutToken: z.string().min(1, "checkoutToken is required"),
});

export const mollieWebhookBodySchema = z.object({
  id: z.string().min(1, "Mollie payment id is required"),
});

export type ReportType = z.infer<typeof reportTypeSchema>;
export type CreateMolliePaymentInput = z.infer<
  typeof createMolliePaymentSchema
>;
