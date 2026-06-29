import { z } from "zod";

export const soldHomeBenchmarkReportQuerySchema = z.object({
  reportId: z.coerce.number().int().positive("reportId is required"),
});

export type SoldHomeBenchmarkReportQuery = z.infer<
  typeof soldHomeBenchmarkReportQuerySchema
>;
