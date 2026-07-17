-- CreateEnum
CREATE TYPE "PropertyDataSource" AS ENUM ('KADASTER', 'PDOK', 'EP_ONLINE', 'WOZ', 'CBS', 'INTERNAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PropertySourceCallType" AS ENUM ('LIVE_PAID', 'LIVE_FREE', 'MANUAL_IMPORT');

-- CreateEnum
CREATE TYPE "PropertySourceCallStatus" AS ENUM ('SUCCESS', 'FAILED', 'PARTIAL');

-- CreateEnum
CREATE TYPE "PropertyTransactionType" AS ENUM ('SALE', 'AUCTION');

-- CreateEnum
CREATE TYPE "ValuationConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateTable
CREATE TABLE "properties" (
    "id" SERIAL NOT NULL,
    "address_key" TEXT NOT NULL,
    "display_address" TEXT NOT NULL,
    "street" TEXT,
    "house_number" TEXT,
    "house_letter" TEXT,
    "house_number_addition" TEXT,
    "postcode" TEXT,
    "city" TEXT,
    "municipality" TEXT,
    "bag_vbo_id" TEXT,
    "bag_pand_id" TEXT,
    "bag_nummeraanduiding_id" TEXT,
    "kadaster_number" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postal_code_areas" (
    "id" SERIAL NOT NULL,
    "postal_code" TEXT NOT NULL,
    "city" TEXT,
    "municipality" TEXT,
    "municipality_code" TEXT,
    "province" TEXT,
    "province_code" TEXT,
    "buurt_code" TEXT,
    "buurt_name" TEXT,
    "wijk_code" TEXT,
    "wijk_name" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postal_code_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "postal_code_snapshots" (
    "id" SERIAL NOT NULL,
    "postal_code_area_id" INTEGER NOT NULL,
    "source" "PropertyDataSource" NOT NULL,
    "source_product" TEXT NOT NULL,
    "call_type" "PropertySourceCallType" NOT NULL,
    "status" "PropertySourceCallStatus" NOT NULL,
    "cost_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "snapshot_type" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "normalized_payload" JSONB,
    "request_hash" TEXT,
    "response_hash" TEXT,
    "normalized_hash" TEXT,
    "metadata" JSONB,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "postal_code_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_source_calls" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source" "PropertyDataSource" NOT NULL,
    "source_product" TEXT NOT NULL,
    "call_type" "PropertySourceCallType" NOT NULL,
    "status" "PropertySourceCallStatus" NOT NULL,
    "cost_cents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "request_hash" TEXT,
    "response_hash" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_source_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_source_snapshots" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_call_id" INTEGER NOT NULL,
    "source" "PropertyDataSource" NOT NULL,
    "source_product" TEXT NOT NULL,
    "raw_payload" JSONB NOT NULL,
    "normalized_payload" JSONB,
    "response_hash" TEXT,
    "normalized_hash" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_source_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_current_facts" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "last_source_call_id" INTEGER,
    "living_area_m2" INTEGER,
    "plot_area_m2" INTEGER,
    "build_year" INTEGER,
    "property_type" TEXT,
    "usage_purpose" TEXT,
    "energy_label" TEXT,
    "last_sale_price_eur" INTEGER,
    "last_sale_date" TIMESTAMP(3),
    "ownership_owner_type" TEXT,
    "owner_share_count" INTEGER,
    "has_active_mortgage" BOOLEAN,
    "has_legal_encumbrance" BOOLEAN,
    "kadaster_number" TEXT,
    "estimated_value_eur" INTEGER,
    "valuation_confidence" "ValuationConfidence",
    "data_hash" TEXT,
    "last_refreshed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_current_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_fact_snapshots" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_call_id" INTEGER NOT NULL,
    "living_area_m2" INTEGER,
    "plot_area_m2" INTEGER,
    "build_year" INTEGER,
    "property_type" TEXT,
    "usage_purpose" TEXT,
    "bag_vbo_status" TEXT,
    "bag_pand_status" TEXT,
    "normalized_hash" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_fact_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_sale_snapshots" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_call_id" INTEGER NOT NULL,
    "sale_date" TIMESTAMP(3),
    "sale_year" INTEGER,
    "sale_price_eur" INTEGER,
    "price_per_sqm_eur" INTEGER,
    "surface_area_m2" INTEGER,
    "transaction_type" "PropertyTransactionType" NOT NULL DEFAULT 'SALE',
    "multiple_real_estate" BOOLEAN,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "normalized_hash" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_sale_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_ownership_snapshots" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_call_id" INTEGER NOT NULL,
    "owner_type" TEXT,
    "owner_share_count" INTEGER,
    "has_active_mortgage" BOOLEAN NOT NULL DEFAULT false,
    "has_legal_encumbrance" BOOLEAN NOT NULL DEFAULT false,
    "has_annotations" BOOLEAN,
    "has_seizure" BOOLEAN,
    "kadaster_number" TEXT,
    "section" TEXT,
    "plot_number" TEXT,
    "normalized_hash" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_ownership_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_ownership_right_snapshots" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_call_id" INTEGER NOT NULL,
    "ownership_snapshot_id" INTEGER NOT NULL,
    "right_description" TEXT,
    "holder_type" TEXT,
    "share" TEXT,
    "registration_date" TIMESTAMP(3),
    "deed_reference" TEXT,
    "kadaster_number" TEXT,
    "normalized_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_ownership_right_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_energy_label_snapshots" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_call_id" INTEGER NOT NULL,
    "label" TEXT,
    "energy_index" DECIMAL(10,3),
    "issued_at" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "source_bag_id" TEXT,
    "normalized_hash" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_energy_label_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_woz_value_snapshots" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_call_id" INTEGER NOT NULL,
    "value_year" INTEGER NOT NULL,
    "value_eur" INTEGER NOT NULL,
    "reference_date" TIMESTAMP(3),
    "normalized_hash" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_woz_value_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_valuation_snapshots" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_call_id" INTEGER NOT NULL,
    "estimated_value_eur" INTEGER NOT NULL,
    "value_low_eur" INTEGER NOT NULL,
    "value_high_eur" INTEGER NOT NULL,
    "confidence" "ValuationConfidence" NOT NULL,
    "price_per_sqm_eur" INTEGER NOT NULL,
    "last_sale_price_eur" INTEGER,
    "last_sale_date" TIMESTAMP(3),
    "methodology" TEXT NOT NULL,
    "comparables_used" INTEGER NOT NULL DEFAULT 0,
    "model_version" TEXT,
    "input_hash" TEXT,
    "normalized_hash" TEXT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_valuation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "property_comparable_sale_snapshots" (
    "id" SERIAL NOT NULL,
    "property_id" INTEGER NOT NULL,
    "source_call_id" INTEGER NOT NULL,
    "valuation_snapshot_id" INTEGER,
    "address" TEXT NOT NULL,
    "distance_meters" INTEGER,
    "sale_date" TIMESTAMP(3),
    "sale_price_eur" INTEGER,
    "surface_area_m2" INTEGER,
    "price_per_sqm_eur" INTEGER,
    "build_year" INTEGER,
    "similarity_score" DECIMAL(5,2),
    "normalized_hash" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "property_comparable_sale_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "properties_address_key_key" ON "properties"("address_key");

-- CreateIndex
CREATE UNIQUE INDEX "properties_bag_vbo_id_key" ON "properties"("bag_vbo_id");

-- CreateIndex
CREATE INDEX "properties_postcode_idx" ON "properties"("postcode");

-- CreateIndex
CREATE INDEX "properties_city_idx" ON "properties"("city");

-- CreateIndex
CREATE INDEX "properties_kadaster_number_idx" ON "properties"("kadaster_number");

-- CreateIndex
CREATE UNIQUE INDEX "postal_code_areas_postal_code_key" ON "postal_code_areas"("postal_code");

-- CreateIndex
CREATE INDEX "postal_code_areas_city_idx" ON "postal_code_areas"("city");

-- CreateIndex
CREATE INDEX "postal_code_areas_municipality_code_idx" ON "postal_code_areas"("municipality_code");

-- CreateIndex
CREATE INDEX "postal_code_areas_buurt_code_idx" ON "postal_code_areas"("buurt_code");

-- CreateIndex
CREATE INDEX "postal_code_snapshots_postal_code_area_id_fetched_at_idx" ON "postal_code_snapshots"("postal_code_area_id", "fetched_at");

-- CreateIndex
CREATE INDEX "postal_code_snapshots_source_source_product_idx" ON "postal_code_snapshots"("source", "source_product");

-- CreateIndex
CREATE INDEX "postal_code_snapshots_call_type_idx" ON "postal_code_snapshots"("call_type");

-- CreateIndex
CREATE INDEX "postal_code_snapshots_status_idx" ON "postal_code_snapshots"("status");

-- CreateIndex
CREATE INDEX "postal_code_snapshots_snapshot_type_idx" ON "postal_code_snapshots"("snapshot_type");

-- CreateIndex
CREATE INDEX "postal_code_snapshots_requested_at_idx" ON "postal_code_snapshots"("requested_at");

-- CreateIndex
CREATE INDEX "postal_code_snapshots_response_hash_idx" ON "postal_code_snapshots"("response_hash");

-- CreateIndex
CREATE INDEX "postal_code_snapshots_normalized_hash_idx" ON "postal_code_snapshots"("normalized_hash");

-- CreateIndex
CREATE INDEX "property_source_calls_property_id_idx" ON "property_source_calls"("property_id");

-- CreateIndex
CREATE INDEX "property_source_calls_source_source_product_idx" ON "property_source_calls"("source", "source_product");

-- CreateIndex
CREATE INDEX "property_source_calls_call_type_idx" ON "property_source_calls"("call_type");

-- CreateIndex
CREATE INDEX "property_source_calls_status_idx" ON "property_source_calls"("status");

-- CreateIndex
CREATE INDEX "property_source_calls_requested_at_idx" ON "property_source_calls"("requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "property_source_snapshots_source_call_id_key" ON "property_source_snapshots"("source_call_id");

-- CreateIndex
CREATE INDEX "property_source_snapshots_property_id_fetched_at_idx" ON "property_source_snapshots"("property_id", "fetched_at");

-- CreateIndex
CREATE INDEX "property_source_snapshots_source_source_product_idx" ON "property_source_snapshots"("source", "source_product");

-- CreateIndex
CREATE INDEX "property_source_snapshots_response_hash_idx" ON "property_source_snapshots"("response_hash");

-- CreateIndex
CREATE INDEX "property_source_snapshots_normalized_hash_idx" ON "property_source_snapshots"("normalized_hash");

-- CreateIndex
CREATE UNIQUE INDEX "property_current_facts_property_id_key" ON "property_current_facts"("property_id");

-- CreateIndex
CREATE INDEX "property_current_facts_last_source_call_id_idx" ON "property_current_facts"("last_source_call_id");

-- CreateIndex
CREATE INDEX "property_current_facts_last_refreshed_at_idx" ON "property_current_facts"("last_refreshed_at");

-- CreateIndex
CREATE INDEX "property_fact_snapshots_property_id_fetched_at_idx" ON "property_fact_snapshots"("property_id", "fetched_at");

-- CreateIndex
CREATE INDEX "property_fact_snapshots_source_call_id_idx" ON "property_fact_snapshots"("source_call_id");

-- CreateIndex
CREATE INDEX "property_fact_snapshots_normalized_hash_idx" ON "property_fact_snapshots"("normalized_hash");

-- CreateIndex
CREATE INDEX "property_sale_snapshots_property_id_fetched_at_idx" ON "property_sale_snapshots"("property_id", "fetched_at");

-- CreateIndex
CREATE INDEX "property_sale_snapshots_source_call_id_idx" ON "property_sale_snapshots"("source_call_id");

-- CreateIndex
CREATE INDEX "property_sale_snapshots_sale_year_idx" ON "property_sale_snapshots"("sale_year");

-- CreateIndex
CREATE INDEX "property_sale_snapshots_normalized_hash_idx" ON "property_sale_snapshots"("normalized_hash");

-- CreateIndex
CREATE INDEX "property_ownership_snapshots_property_id_fetched_at_idx" ON "property_ownership_snapshots"("property_id", "fetched_at");

-- CreateIndex
CREATE INDEX "property_ownership_snapshots_source_call_id_idx" ON "property_ownership_snapshots"("source_call_id");

-- CreateIndex
CREATE INDEX "property_ownership_snapshots_normalized_hash_idx" ON "property_ownership_snapshots"("normalized_hash");

-- CreateIndex
CREATE INDEX "property_ownership_right_snapshots_property_id_idx" ON "property_ownership_right_snapshots"("property_id");

-- CreateIndex
CREATE INDEX "property_ownership_right_snapshots_source_call_id_idx" ON "property_ownership_right_snapshots"("source_call_id");

-- CreateIndex
CREATE INDEX "property_ownership_right_snapshots_ownership_snapshot_id_idx" ON "property_ownership_right_snapshots"("ownership_snapshot_id");

-- CreateIndex
CREATE INDEX "property_ownership_right_snapshots_normalized_hash_idx" ON "property_ownership_right_snapshots"("normalized_hash");

-- CreateIndex
CREATE INDEX "property_energy_label_snapshots_property_id_fetched_at_idx" ON "property_energy_label_snapshots"("property_id", "fetched_at");

-- CreateIndex
CREATE INDEX "property_energy_label_snapshots_source_call_id_idx" ON "property_energy_label_snapshots"("source_call_id");

-- CreateIndex
CREATE INDEX "property_energy_label_snapshots_label_idx" ON "property_energy_label_snapshots"("label");

-- CreateIndex
CREATE INDEX "property_energy_label_snapshots_normalized_hash_idx" ON "property_energy_label_snapshots"("normalized_hash");

-- CreateIndex
CREATE INDEX "property_woz_value_snapshots_property_id_value_year_idx" ON "property_woz_value_snapshots"("property_id", "value_year");

-- CreateIndex
CREATE INDEX "property_woz_value_snapshots_source_call_id_idx" ON "property_woz_value_snapshots"("source_call_id");

-- CreateIndex
CREATE INDEX "property_woz_value_snapshots_normalized_hash_idx" ON "property_woz_value_snapshots"("normalized_hash");

-- CreateIndex
CREATE INDEX "property_valuation_snapshots_property_id_calculated_at_idx" ON "property_valuation_snapshots"("property_id", "calculated_at");

-- CreateIndex
CREATE INDEX "property_valuation_snapshots_source_call_id_idx" ON "property_valuation_snapshots"("source_call_id");

-- CreateIndex
CREATE INDEX "property_valuation_snapshots_normalized_hash_idx" ON "property_valuation_snapshots"("normalized_hash");

-- CreateIndex
CREATE INDEX "property_comparable_sale_snapshots_property_id_fetched_at_idx" ON "property_comparable_sale_snapshots"("property_id", "fetched_at");

-- CreateIndex
CREATE INDEX "property_comparable_sale_snapshots_source_call_id_idx" ON "property_comparable_sale_snapshots"("source_call_id");

-- CreateIndex
CREATE INDEX "property_comparable_sale_snapshots_valuation_snapshot_id_idx" ON "property_comparable_sale_snapshots"("valuation_snapshot_id");

-- CreateIndex
CREATE INDEX "property_comparable_sale_snapshots_normalized_hash_idx" ON "property_comparable_sale_snapshots"("normalized_hash");

-- AddForeignKey
ALTER TABLE "postal_code_snapshots" ADD CONSTRAINT "postal_code_snapshots_postal_code_area_id_fkey" FOREIGN KEY ("postal_code_area_id") REFERENCES "postal_code_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_source_calls" ADD CONSTRAINT "property_source_calls_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_source_snapshots" ADD CONSTRAINT "property_source_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_source_snapshots" ADD CONSTRAINT "property_source_snapshots_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "property_source_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_current_facts" ADD CONSTRAINT "property_current_facts_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_current_facts" ADD CONSTRAINT "property_current_facts_last_source_call_id_fkey" FOREIGN KEY ("last_source_call_id") REFERENCES "property_source_calls"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_fact_snapshots" ADD CONSTRAINT "property_fact_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_fact_snapshots" ADD CONSTRAINT "property_fact_snapshots_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "property_source_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_sale_snapshots" ADD CONSTRAINT "property_sale_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_sale_snapshots" ADD CONSTRAINT "property_sale_snapshots_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "property_source_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownership_snapshots" ADD CONSTRAINT "property_ownership_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownership_snapshots" ADD CONSTRAINT "property_ownership_snapshots_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "property_source_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownership_right_snapshots" ADD CONSTRAINT "property_ownership_right_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownership_right_snapshots" ADD CONSTRAINT "property_ownership_right_snapshots_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "property_source_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_ownership_right_snapshots" ADD CONSTRAINT "property_ownership_right_snapshots_ownership_snapshot_id_fkey" FOREIGN KEY ("ownership_snapshot_id") REFERENCES "property_ownership_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_energy_label_snapshots" ADD CONSTRAINT "property_energy_label_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_energy_label_snapshots" ADD CONSTRAINT "property_energy_label_snapshots_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "property_source_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_woz_value_snapshots" ADD CONSTRAINT "property_woz_value_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_woz_value_snapshots" ADD CONSTRAINT "property_woz_value_snapshots_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "property_source_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_valuation_snapshots" ADD CONSTRAINT "property_valuation_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_valuation_snapshots" ADD CONSTRAINT "property_valuation_snapshots_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "property_source_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_comparable_sale_snapshots" ADD CONSTRAINT "property_comparable_sale_snapshots_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_comparable_sale_snapshots" ADD CONSTRAINT "property_comparable_sale_snapshots_source_call_id_fkey" FOREIGN KEY ("source_call_id") REFERENCES "property_source_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "property_comparable_sale_snapshots" ADD CONSTRAINT "property_comparable_sale_snapshots_valuation_snapshot_id_fkey" FOREIGN KEY ("valuation_snapshot_id") REFERENCES "property_valuation_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

