DO $$
BEGIN
  CREATE TYPE "VatPriceType" AS ENUM ('ZERO', 'INCLUSIVE', 'EXCLUSIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "report_price_settings"
ADD COLUMN "vat_type" "VatPriceType" NOT NULL DEFAULT 'EXCLUSIVE';

UPDATE "report_price_settings"
SET "vat_type" = 'ZERO'
WHERE "vat_slab_id" IN (
  SELECT "id"
  FROM "vat_slabs"
  WHERE "rate_bps" = 0
);
