ALTER TYPE "PaymentStatus" ADD VALUE 'PENDIENTE_REEMBOLSO';
ALTER TYPE "PaymentStatus" ADD VALUE 'EN_REVISION';
ALTER TABLE "Payment" ADD COLUMN "checkoutSessionId" TEXT,
  ADD COLUMN "refundId" TEXT,
  ADD COLUMN "nextSyncAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Payment_checkoutSessionId_key" ON "Payment"("checkoutSessionId");
CREATE INDEX "Payment_status_nextSyncAt_idx" ON "Payment"("status","nextSyncAt");
