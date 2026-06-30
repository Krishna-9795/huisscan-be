import { z } from "zod";

import { reportTypeSchema } from "./payments.schema";

export const addressAccessQuerySchema = z.object({
  reportType: reportTypeSchema,
  address: z.string().trim().min(1, "address is required"),
});

export type AddressAccessQuery = z.infer<typeof addressAccessQuerySchema>;
