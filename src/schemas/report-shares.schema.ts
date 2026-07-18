import { z } from "zod";

import { reportTypeSchema } from "./payments.schema";

export const shareReportSchema = z.object({
  reportType: reportTypeSchema.refine(
    (value) =>
      value === "last-sale-report" || value === "sold-home-benchmark-report",
    "Only paid downloadable reports can be shared",
  ),
  reportId: z.string().min(1, "reportId is required"),
  recipientEmail: z.string().trim().email("recipientEmail must be a valid email"),
  address: z.string().trim().optional(),
  pdfBase64: z.string().trim().min(1, "pdfBase64 is required"),
  fileName: z.string().trim().min(1).optional(),
});

export type ShareReportInput = z.infer<typeof shareReportSchema>;
