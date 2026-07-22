ALTER TABLE "invoices"
ADD COLUMN "subtotal_amount_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "vat_amount_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "total_amount_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "vat_type" "VatPriceType" NOT NULL DEFAULT 'EXCLUSIVE',
ADD COLUMN "vat_rate_bps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "vat_slab_id" INTEGER,
ADD COLUMN "vat_slab_code" TEXT,
ADD COLUMN "vat_slab_name" TEXT;

UPDATE "invoices"
SET
  "subtotal_amount_cents" = "amountCents",
  "vat_amount_cents" = 0,
  "total_amount_cents" = "amountCents",
  "vat_type" = 'EXCLUSIVE',
  "vat_rate_bps" = 0
WHERE "total_amount_cents" = 0;

CREATE INDEX "invoices_vat_slab_id_idx" ON "invoices"("vat_slab_id");

ALTER TABLE "invoices"
ADD CONSTRAINT "invoices_vat_slab_id_fkey"
FOREIGN KEY ("vat_slab_id") REFERENCES "vat_slabs"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
