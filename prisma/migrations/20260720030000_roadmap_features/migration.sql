-- Enums
DO $$ BEGIN
  CREATE TYPE "OrderReviewStatus" AS ENUM ('NONE', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'CONVERTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AffiliatePayoutStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "GdprRequestType" AS ENUM ('EXPORT', 'DELETE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "GdprRequestStatus" AS ENUM ('PENDING', 'COMPLETED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AutomationTrigger" AS ENUM ('ORDER_PAID', 'INVOICE_OVERDUE', 'SERVICE_SUSPENDED', 'SERVICE_TERMINATED', 'TICKET_OPENED', 'FRAUD_HOLD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AutomationActionType" AS ENUM ('EMAIL', 'WEBHOOK', 'CREATE_TICKET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "permissions" JSONB DEFAULT '[]';
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "riskFlags" JSONB DEFAULT '[]';
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "requireApproval" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "tosAcceptedAt" TIMESTAMP(3);
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "tosVersion" TEXT;
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "reviewStatus" "OrderReviewStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT;

CREATE INDEX IF NOT EXISTS "order_reviewStatus_idx" ON "order"("reviewStatus");

CREATE TABLE IF NOT EXISTS "login_event" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "success" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "login_event_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "login_event_userId_createdAt_idx" ON "login_event"("userId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "login_event" ADD CONSTRAINT "login_event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "fraud_block" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "note" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "fraud_block_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "fraud_block_type_value_key" ON "fraud_block"("type", "value");

CREATE TABLE IF NOT EXISTS "announcement" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "audience" TEXT NOT NULL DEFAULT 'client',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "announcement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "announcement_active_startsAt_idx" ON "announcement"("active", "startsAt");

CREATE TABLE IF NOT EXISTS "quote" (
  "id" TEXT NOT NULL,
  "number" SERIAL NOT NULL,
  "clientId" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "subtotal" INTEGER NOT NULL DEFAULT 0,
  "taxMinor" INTEGER NOT NULL DEFAULT 0,
  "total" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "validUntil" TIMESTAMP(3),
  "invoiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "quote_number_key" ON "quote"("number");
CREATE INDEX IF NOT EXISTS "quote_clientId_status_idx" ON "quote"("clientId", "status");
DO $$ BEGIN
  ALTER TABLE "quote" ADD CONSTRAINT "quote_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "quote_item" (
  "id" TEXT NOT NULL,
  "quoteId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitPrice" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  CONSTRAINT "quote_item_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "quote_item" ADD CONSTRAINT "quote_item_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "service_contributor" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "email" TEXT,
  "canPay" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "service_contributor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "service_contributor_serviceId_clientId_key" ON "service_contributor"("serviceId", "clientId");
CREATE INDEX IF NOT EXISTS "service_contributor_clientId_idx" ON "service_contributor"("clientId");
DO $$ BEGIN
  ALTER TABLE "service_contributor" ADD CONSTRAINT "service_contributor_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "service_contributor" ADD CONSTRAINT "service_contributor_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "affiliate_payout" (
  "id" TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "amountMinor" INTEGER NOT NULL,
  "status" "AffiliatePayoutStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "affiliate_payout_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "affiliate_payout_status_idx" ON "affiliate_payout"("status");
DO $$ BEGIN
  ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_affiliateId_fkey" FOREIGN KEY ("affiliateId") REFERENCES "affiliate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "affiliate_payout" ADD CONSTRAINT "affiliate_payout_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "automation_rule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "trigger" "AutomationTrigger" NOT NULL,
  "actionType" "AutomationActionType" NOT NULL,
  "config" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_rule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "automation_rule_enabled_trigger_idx" ON "automation_rule"("enabled", "trigger");

CREATE TABLE IF NOT EXISTS "legal_page" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT '1',
  "published" BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_page_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "legal_page_slug_key" ON "legal_page"("slug");

CREATE TABLE IF NOT EXISTS "gdpr_request" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "type" "GdprRequestType" NOT NULL,
  "status" "GdprRequestStatus" NOT NULL DEFAULT 'PENDING',
  "note" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "gdpr_request_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "gdpr_request_status_idx" ON "gdpr_request"("status");
DO $$ BEGIN
  ALTER TABLE "gdpr_request" ADD CONSTRAINT "gdpr_request_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
