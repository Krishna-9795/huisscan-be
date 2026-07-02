DROP INDEX IF EXISTS "invoices_provider_providerId_idx";

CREATE UNIQUE INDEX "invoices_provider_providerId_key" ON "invoices"("provider", "providerId");
