import { z } from "zod";

export const propertyTypeSchema = z.enum([
  "ANY",
  "APARTMENT",
  "HOUSE",
  "TOWNHOUSE",
]);

export const buyingStageSchema = z.enum([
  "EXPLORING",
  "SEARCHING",
  "VIEWING",
  "OFFER_MADE",
  "PURCHASED",
]);

export const createUserPreferenceSchema = z
  .object({
    budgetMin: z.number().int().positive().optional(),
    budgetMax: z.number().int().positive().optional(),
    preferredCities: z.array(z.string().min(1)).optional(),
    propertyType: propertyTypeSchema.optional(),
    bedroomsMin: z.number().int().positive().optional(),
    buyingStage: buyingStageSchema.optional(),
  })
  .refine(
    (preferences) =>
      preferences.budgetMin === undefined ||
      preferences.budgetMax === undefined ||
      preferences.budgetMax >= preferences.budgetMin,
    {
      message: "budgetMax must be greater than or equal to budgetMin",
      path: ["budgetMax"],
    },
  );

export const createUserProfileSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100).optional(),
  phone: z.string().min(5).max(30).optional(),
  city: z.string().min(2).max(100).optional(),
  avatarColor: z.string().min(1).default("brand"),
  plan: z.enum(["FREE", "PRO"]).default("FREE"),
  preferences: createUserPreferenceSchema.optional(),
});

export const userIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const nullableTrimmedString = (min: number, max: number) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    },
    z.string().min(min).max(max).nullable(),
  );

export const updateUserPreferenceSchema = z
  .object({
    budgetMin: z.number().int().positive().nullable().optional(),
    budgetMax: z.number().int().positive().nullable().optional(),
    preferredCities: z.array(z.string().trim().min(1)).optional(),
    propertyType: propertyTypeSchema.optional(),
    bedroomsMin: z.number().int().positive().nullable().optional(),
    buyingStage: buyingStageSchema.optional(),
  })
  .refine(
    (preferences) =>
      preferences.budgetMin == null ||
      preferences.budgetMax == null ||
      preferences.budgetMax >= preferences.budgetMin,
    {
      message: "budgetMax must be greater than or equal to budgetMin",
      path: ["budgetMax"],
    },
  );

export const updateUserSchema = z.object({
  email: z.string().trim().email().optional(),
  name: nullableTrimmedString(2, 100).optional(),
  phone: nullableTrimmedString(5, 30).optional(),
  city: nullableTrimmedString(2, 100).optional(),
  avatarColor: z.string().trim().min(1).optional(),
  preferences: updateUserPreferenceSchema.optional(),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateUserProfileInput = z.infer<typeof createUserProfileSchema>;
