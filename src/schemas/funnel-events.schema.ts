import { z } from "zod";

export const funnelEventNameSchema = z.enum([
  "search_typed",
  "suggestion_clicked",
  "preview_viewed",
  "payment_started",
  "payment_completed",
]);

export const createFunnelEventSchema = z.object({
  eventName: funnelEventNameSchema,
  sessionId: z.string().trim().min(8).max(120),
  reportType: z.string().trim().max(80).optional(),
  reportId: z.string().trim().max(160).optional(),
  address: z.string().trim().max(300).optional(),
  query: z.string().trim().max(300).optional(),
  suggestionId: z.string().trim().max(160).optional(),
  paymentId: z.string().trim().max(160).optional(),
  checkoutToken: z.string().trim().max(200).optional(),
  amountCents: z.coerce.number().int().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const funnelEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  sessionId: z.string().trim().min(1).max(120).optional(),
  eventName: funnelEventNameSchema.optional(),
});

export type CreateFunnelEventInput = z.infer<typeof createFunnelEventSchema>;
