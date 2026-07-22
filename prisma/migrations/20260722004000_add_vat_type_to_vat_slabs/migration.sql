ALTER TABLE "vat_slabs"
ADD COLUMN "vat_type" "VatPriceType" NOT NULL DEFAULT 'EXCLUSIVE';

UPDATE "vat_slabs" vs
SET "vat_type" = rps."vat_type"
FROM (
  SELECT DISTINCT ON ("vat_slab_id")
    "vat_slab_id",
    "vat_type"
  FROM "report_price_settings"
  ORDER BY "vat_slab_id", "updated_at" DESC
) rps
WHERE rps."vat_slab_id" = vs."id";

UPDATE "vat_slabs"
SET "vat_type" = 'ZERO'
WHERE "rate_bps" = 0;
