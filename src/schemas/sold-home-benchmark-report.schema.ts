import { z } from "zod";

export const soldHomeBenchmarkReportQuerySchema = z.object({
  reportId: z.string().min(1, "reportId is required"),
});

export type SoldHomeBenchmarkReportQuery = z.infer<
  typeof soldHomeBenchmarkReportQuerySchema
>;
