import { z } from "zod";

export const kadasterDashboardQuerySchema = z.object({
  address: z.string().trim().min(3, "address is required"),
});

export const archiveKadasterDashboardSchema = z.object({
  address: z.string().trim().min(3, "address is required"),
  reportId: z.string().trim().min(1).optional(),
  cacheKey: z.string().trim().min(1).optional(),
  dashboard: z.unknown(),
});

export type ArchiveKadasterDashboardInput = z.infer<
  typeof archiveKadasterDashboardSchema
>;
