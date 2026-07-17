import { z } from "zod";

import { reportTypeSchema } from "./payments.schema";

export const reportArtifactTypeSchema = z.enum(["pdf"]);

export const createUserReportArtifactSchema = z.object({
  reportType: reportTypeSchema.refine(
    (value) =>
      value === "last-sale-report" || value === "sold-home-benchmark-report",
    "Only paid downloadable reports can create artifacts",
  ),
  reportId: z.string().min(1, "reportId is required"),
  artifactType: reportArtifactTypeSchema.default("pdf"),
  storageKey: z.string().trim().min(1).optional(),
  publicUrl: z.string().trim().min(1).optional(),
  fileName: z.string().trim().min(1).optional(),
  status: z.enum(["pending", "generated", "failed"]).default("generated"),
});

export type CreateUserReportArtifactInput = z.infer<
  typeof createUserReportArtifactSchema
>;
