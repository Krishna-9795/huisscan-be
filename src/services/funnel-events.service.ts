import { PrismaClient } from "@prisma/client";

import {
  CreateFunnelEventData,
  FunnelEventRow,
  FunnelEventsRepository,
} from "../repositories/funnel-events.repository";

export class FunnelEventsService {
  private readonly funnelEventsRepository: FunnelEventsRepository;

  constructor(prisma: PrismaClient) {
    this.funnelEventsRepository = new FunnelEventsRepository(prisma);
  }

  async create(data: CreateFunnelEventData) {
    const event = await this.funnelEventsRepository.create(data);
    return toPublicFunnelEvent(event);
  }

  async getLatest(input: {
    limit: number;
    sessionId?: string;
    eventName?: string;
  }) {
    const events = await this.funnelEventsRepository.findLatest(input);
    return events.map(toPublicFunnelEvent);
  }
}

function toPublicFunnelEvent(event: FunnelEventRow) {
  return {
    id: event.id,
    eventName: event.event_name,
    sessionId: event.session_id,
    userId: event.user_id,
    reportType: event.report_type,
    reportId: event.report_id,
    address: event.address,
    query: event.query,
    suggestionId: event.suggestion_id,
    paymentId: event.payment_id,
    checkoutToken: event.checkout_token,
    amountCents: event.amount_cents,
    currency: event.currency,
    metadata: event.metadata,
    userAgent: event.user_agent,
    referer: event.referer,
    createdAt: event.created_at,
  };
}
