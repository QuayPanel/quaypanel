-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EmailCampaignStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_campaign" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "filter" TEXT NOT NULL DEFAULT 'all',
  "productId" TEXT,
  "status" "EmailCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "email_campaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "email_campaign_status_createdAt_idx" ON "email_campaign"("status", "createdAt");
