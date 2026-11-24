ALTER TABLE "Payment" ADD COLUMN "stripeLivemode" BOOLEAN NOT NULL DEFAULT false;
DROP INDEX "Payment_status_nextSyncAt_idx";
CREATE INDEX "Payment_stripeLivemode_status_nextSyncAt_idx" ON "Payment"("stripeLivemode", "status", "nextSyncAt");
