-- AlterTable
ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "cancelAt" TIMESTAMP(3);
ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "cancelRequestedAt" TIMESTAMP(3);
ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "service_cancelAt_idx" ON "service"("cancelAt");
