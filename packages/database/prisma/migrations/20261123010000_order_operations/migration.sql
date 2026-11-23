CREATE TABLE "OrderOperation" (
  "id" UUID PRIMARY KEY,
  "orderId" UUID NOT NULL REFERENCES "Order"("id") ON DELETE CASCADE,
  "actorId" UUID NOT NULL,
  "previous" "OrderStatus" NOT NULL,
  "next" "OrderStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OrderOperation_orderId_createdAt_idx" ON "OrderOperation"("orderId","createdAt");
