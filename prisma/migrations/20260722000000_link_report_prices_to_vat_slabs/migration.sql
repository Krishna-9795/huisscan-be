ALTER TABLE "report_price_settings"
ADD COLUMN "vat_slab_id" INTEGER;

UPDATE "report_price_settings"
SET "vat_slab_id" = (
  SELECT "id"
  FROM "vat_slabs"
  WHERE "code" = 'VAT_0'
  LIMIT 1
)
WHERE "vat_slab_id" IS NULL;

ALTER TABLE "report_price_settings"
ALTER COLUMN "vat_slab_id" SET NOT NULL;

CREATE INDEX "report_price_settings_vat_slab_id_idx"
  ON "report_price_settings"("vat_slab_id");

ALTER TABLE "report_price_settings"
ADD CONSTRAINT "report_price_settings_vat_slab_id_fkey"
FOREIGN KEY ("vat_slab_id") REFERENCES "vat_slabs"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
