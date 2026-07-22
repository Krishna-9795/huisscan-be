UPDATE "report_price_settings"
SET "vat_type" = 'EXCLUSIVE'
WHERE "vat_type" = 'ZERO';
