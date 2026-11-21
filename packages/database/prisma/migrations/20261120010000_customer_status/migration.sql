ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "CustomerStatusAudit" (
  "id" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "active" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerStatusAudit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerStatusAudit_customerId_createdAt_idx" ON "CustomerStatusAudit"("customerId", "createdAt");
