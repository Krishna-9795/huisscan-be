-- AlterTable
ALTER TABLE "report_payments" ADD COLUMN "userId" TEXT;
ALTER TABLE "report_payments" ADD COLUMN "invoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "report_payments_invoiceId_key" ON "report_payments"("invoiceId");

-- CreateIndex
CREATE INDEX "report_payments_userId_idx" ON "report_payments"("userId");

-- AddForeignKey
ALTER TABLE "report_payments" ADD CONSTRAINT "report_payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_payments" ADD CONSTRAINT "report_payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
