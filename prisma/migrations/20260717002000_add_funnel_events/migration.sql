CREATE TABLE "funnel_events" (
  "id" SERIAL PRIMARY KEY,
  "event_name" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "user_id" INTEGER,
  "report_type" TEXT,
  "report_id" TEXT,
  "address" TEXT,
  "query" TEXT,
  "suggestion_id" TEXT,
  "payment_id" TEXT,
  "checkout_token" TEXT,
  "amount_cents" INTEGER,
  "currency" TEXT,
  "metadata" JSONB,
  "user_agent" TEXT,
  "referer" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "funnel_events_event_name_idx" ON "funnel_events"("event_name");
CREATE INDEX "funnel_events_session_id_idx" ON "funnel_events"("session_id");
CREATE INDEX "funnel_events_user_id_idx" ON "funnel_events"("user_id");
CREATE INDEX "funnel_events_report_type_report_id_idx" ON "funnel_events"("report_type", "report_id");
CREATE INDEX "funnel_events_payment_id_idx" ON "funnel_events"("payment_id");
CREATE INDEX "funnel_events_created_at_idx" ON "funnel_events"("created_at");
