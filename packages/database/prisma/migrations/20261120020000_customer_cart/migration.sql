CREATE TABLE "CartItem" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CartItem_quantity_check" CHECK ("quantity" > 0 AND "quantity" <= 1000)
);
CREATE UNIQUE INDEX "CartItem_userId_slug_key" ON "CartItem"("userId", "slug");
CREATE INDEX "CartItem_userId_createdAt_idx" ON "CartItem"("userId", "createdAt");
