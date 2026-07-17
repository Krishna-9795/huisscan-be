-- CreateTable
CREATE TABLE "user_report_artifacts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "report_payment_id" INTEGER NOT NULL,
    "artifact_type" TEXT NOT NULL DEFAULT 'pdf',
    "storage_key" TEXT,
    "public_url" TEXT,
    "file_name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_report_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_report_artifacts_user_id_idx" ON "user_report_artifacts"("user_id");

-- CreateIndex
CREATE INDEX "user_report_artifacts_report_payment_id_idx" ON "user_report_artifacts"("report_payment_id");

-- CreateIndex
CREATE INDEX "user_report_artifacts_status_idx" ON "user_report_artifacts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_report_artifacts_report_payment_id_artifact_type_key" ON "user_report_artifacts"("report_payment_id", "artifact_type");

-- AddForeignKey
ALTER TABLE "user_report_artifacts" ADD CONSTRAINT "user_report_artifacts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_report_artifacts" ADD CONSTRAINT "user_report_artifacts_report_payment_id_fkey" FOREIGN KEY ("report_payment_id") REFERENCES "report_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
