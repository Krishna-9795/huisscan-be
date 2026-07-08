import { z } from "zod";

export const kadasterDashboardQuerySchema = z.object({
  address: z.string().trim().min(3, "address is required"),
});
