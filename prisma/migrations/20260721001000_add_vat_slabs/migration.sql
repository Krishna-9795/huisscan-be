CREATE TABLE "vat_slabs" (
  "id" SERIAL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rate_bps" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "vat_slabs_code_key"
  ON "vat_slabs"("code");

CREATE INDEX "vat_slabs_is_active_idx"
  ON "vat_slabs"("is_active");

INSERT INTO "vat_slabs"
  ("code", "name", "rate_bps", "is_active")
VALUES
  ('VAT_0', '0% VAT', 0, true),
  ('VAT_9', '9% VAT', 900, true),
  ('VAT_21', '21% VAT', 2100, true)
ON CONFLICT ("code") DO NOTHING;
