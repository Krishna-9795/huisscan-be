CREATE TABLE "report_price_settings" (
  "id" SERIAL PRIMARY KEY,
  "report_type" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'EUR',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "updated_by_user_id" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "report_price_settings_report_type_key"
  ON "report_price_settings"("report_type");

CREATE INDEX "report_price_settings_is_active_idx"
  ON "report_price_settings"("is_active");

INSERT INTO "report_price_settings"
  ("report_type", "label", "amount_cents", "currency", "is_active")
VALUES
  ('property-report', 'HuisValue property report', 495, 'EUR', true),
  ('last-sale-report', 'Last sale report', 999, 'EUR', true),
  ('sold-home-benchmark-report', 'Sold Home Benchmark Report', 999, 'EUR', true)
ON CONFLICT ("report_type") DO NOTHING;
