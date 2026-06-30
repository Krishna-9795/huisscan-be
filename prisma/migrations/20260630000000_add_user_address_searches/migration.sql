-- CreateTable
CREATE TABLE "user_address_searches" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "reportType" TEXT NOT NULL,
    "reportId" TEXT,
    "address" TEXT NOT NULL,
    "addressKey" TEXT NOT NULL,
    "lastPaymentId" INTEGER,
    "lastMolliePaymentId" TEXT,
    "invoiceId" INTEGER,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "paidAt" TIMESTAMP(3),
    "freeAccessUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_address_searches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_address_searches_userId_reportType_addressKey_key" ON "user_address_searches"("userId", "reportType", "addressKey");

-- CreateIndex
CREATE INDEX "user_address_searches_userId_idx" ON "user_address_searches"("userId");

-- CreateIndex
CREATE INDEX "user_address_searches_userId_freeAccessUntil_idx" ON "user_address_searches"("userId", "freeAccessUntil");

-- AddForeignKey
ALTER TABLE "user_address_searches" ADD CONSTRAINT "user_address_searches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_address_searches" ADD CONSTRAINT "user_address_searches_lastPaymentId_fkey" FOREIGN KEY ("lastPaymentId") REFERENCES "report_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_address_searches" ADD CONSTRAINT "user_address_searches_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
