import { z } from "zod";

import { reportTypeSchema } from "./payments.schema";

export const reportPriceSettingParamsSchema = z.object({
  reportType: reportTypeSchema,
});

export const updateReportPriceSettingBodySchema = z.object({
  amountCents: z.coerce
    .number()
    .int()
    .min(100, "Price must be at least EUR 1.00")
    .max(100000, "Price cannot exceed EUR 1,000.00"),
  vatSlabId: z.coerce.number().int().positive().optional(),
  vatType: z.enum(["ZERO", "INCLUSIVE", "EXCLUSIVE"]).optional(),
  label: z.string().trim().min(1).max(80).optional(),
  currency: z
    .string()
    .trim()
    .length(3)
    .transform((value) => value.toUpperCase())
    .default("EUR"),
});
