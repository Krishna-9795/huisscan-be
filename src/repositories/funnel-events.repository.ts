import { Prisma, PrismaClient } from "@prisma/client";

export type FunnelEventRow = {
  id: number;
  event_name: string;
  session_id: string;
  user_id: number | null;
  report_type: string | null;
  report_id: string | null;
  address: string | null;
  query: string | null;
  suggestion_id: string | null;
  payment_id: string | null;
  checkout_token: string | null;
  amount_cents: number | null;
  currency: string | null;
  metadata: unknown;
  user_agent: string | null;
  referer: string | null;
  created_at: Date;
};

export type CreateFunnelEventData = {
  eventName: string;
  sessionId: string;
  userId?: number;
  reportType?: string;
  reportId?: string;
  address?: string;
  query?: string;
  suggestionId?: string;
  paymentId?: string;
  checkoutToken?: string;
  amountCents?: number;
  currency?: string;
  metadata?: Prisma.InputJsonValue;
  userAgent?: string;
  referer?: string;
};

export class FunnelEventsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateFunnelEventData) {
    const metadataJson =
      data.metadata === undefined ? null : JSON.stringify(data.metadata);
    const rows = await this.prisma.$queryRaw<FunnelEventRow[]>`
      INSERT INTO funnel_events
        (
          event_name,
          session_id,
          user_id,
          report_type,
          report_id,
          address,
          query,
          suggestion_id,
          payment_id,
          checkout_token,
          amount_cents,
          currency,
          metadata,
          user_agent,
          referer
        )
      VALUES
        (
          ${data.eventName},
          ${data.sessionId},
          ${data.userId ?? null},
          ${data.reportType ?? null},
          ${data.reportId ?? null},
          ${data.address ?? null},
          ${data.query ?? null},
          ${data.suggestionId ?? null},
          ${data.paymentId ?? null},
          ${data.checkoutToken ?? null},
          ${data.amountCents ?? null},
          ${data.currency ?? null},
          CAST(${metadataJson} AS JSONB),
          ${data.userAgent ?? null},
          ${data.referer ?? null}
        )
      RETURNING
        id,
        event_name,
        session_id,
        user_id,
        report_type,
        report_id,
        address,
        query,
        suggestion_id,
        payment_id,
        checkout_token,
        amount_cents,
        currency,
        metadata,
        user_agent,
        referer,
        created_at
    `;

    return rows[0];
  }

  findLatest(input: { limit: number; sessionId?: string; eventName?: string }) {
    if (input.sessionId && input.eventName) {
      return this.prisma.$queryRaw<FunnelEventRow[]>`
        SELECT * FROM funnel_events
        WHERE session_id = ${input.sessionId}
          AND event_name = ${input.eventName}
        ORDER BY created_at DESC
        LIMIT ${input.limit}
      `;
    }

    if (input.sessionId) {
      return this.prisma.$queryRaw<FunnelEventRow[]>`
        SELECT * FROM funnel_events
        WHERE session_id = ${input.sessionId}
        ORDER BY created_at DESC
        LIMIT ${input.limit}
      `;
    }

    if (input.eventName) {
      return this.prisma.$queryRaw<FunnelEventRow[]>`
        SELECT * FROM funnel_events
        WHERE event_name = ${input.eventName}
        ORDER BY created_at DESC
        LIMIT ${input.limit}
      `;
    }

    return this.prisma.$queryRaw<FunnelEventRow[]>`
      SELECT * FROM funnel_events
      ORDER BY created_at DESC
      LIMIT ${input.limit}
    `;
  }
}
