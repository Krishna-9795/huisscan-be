import { Prisma } from "@prisma/client";
import { z } from "zod";

export const createSavedReportSchema = z.object({
  propertyId: z.string().min(1),
  address: z.string().min(1),
  reportData: z.custom<Prisma.InputJsonValue>((value) => value !== undefined, {
    message: "reportData is required",
  }),
});

export const savedReportIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export type CreateSavedReportInput = z.infer<typeof createSavedReportSchema>;
export type SavedReportIdParams = z.infer<typeof savedReportIdParamsSchema>;
