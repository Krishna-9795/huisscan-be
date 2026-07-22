import { z } from "zod";

export const vatSlabIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const vatSlabCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(
    /^[A-Z0-9_]+$/,
    "Code must contain only uppercase letters, numbers, and underscores",
  );

export const createVatSlabBodySchema = z.object({
  code: vatSlabCodeSchema,
  name: z.string().trim().min(2).max(80),
  rateBps: z.coerce
    .number()
    .int()
    .min(0, "VAT percentage cannot be negative")
    .max(10000, "VAT percentage cannot exceed 100%"),
  vatType: z.enum(["ZERO", "INCLUSIVE", "EXCLUSIVE"]).default("EXCLUSIVE"),
  isActive: z.boolean().default(true),
});

export const updateVatSlabBodySchema = z
  .object({
    code: vatSlabCodeSchema.optional(),
    name: z.string().trim().min(2).max(80).optional(),
    rateBps: z.coerce
      .number()
      .int()
      .min(0, "VAT percentage cannot be negative")
      .max(10000, "VAT percentage cannot exceed 100%")
      .optional(),
    vatType: z.enum(["ZERO", "INCLUSIVE", "EXCLUSIVE"]).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one VAT slab field is required",
  });

export type CreateVatSlabInput = z.infer<typeof createVatSlabBodySchema>;
export type UpdateVatSlabInput = z.infer<typeof updateVatSlabBodySchema>;
export type VatSlabIdParams = z.infer<typeof vatSlabIdParamsSchema>;
