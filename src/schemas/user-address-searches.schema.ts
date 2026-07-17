import { z } from "zod";

import { reportTypeSchema } from "./payments.schema";

export const addressAccessQuerySchema = z.object({
  reportType: reportTypeSchema,
  address: z.string().trim().min(1, "address is required"),
});

export const recordAddressSearchSchema = z.object({
  reportType: reportTypeSchema.default("property-report"),
  reportId: z.string().trim().min(1, "reportId is required").optional(),
  address: z.string().trim().min(1, "address is required"),
});

export type AddressAccessQuery = z.infer<typeof addressAccessQuerySchema>;
export type RecordAddressSearchInput = z.infer<
  typeof recordAddressSearchSchema
>;
