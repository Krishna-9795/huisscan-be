-- CreateTable
CREATE TABLE "report_payments" (
    "id" SERIAL NOT NULL,
    "molliePaymentId" TEXT NOT NULL,
    "checkoutToken" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "address" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "returnTo" TEXT,
    "metadata" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_payments_molliePaymentId_key" ON "report_payments"("molliePaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "report_payments_checkoutToken_key" ON "report_payments"("checkoutToken");

-- CreateIndex
CREATE INDEX "report_payments_reportType_reportId_idx" ON "report_payments"("reportType", "reportId");

-- CreateIndex
CREATE INDEX "report_payments_status_idx" ON "report_payments"("status");
