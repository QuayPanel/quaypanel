-- Catch-up: schema fields/tables that existed in Prisma but had no migration

CREATE TYPE "AllowQuantity" AS ENUM ('NO', 'SEPARATED', 'COMBINED');
CREATE TYPE "CreditType" AS ENUM ('DEPOSIT', 'PURCHASE', 'ADJUSTMENT', 'DOWNGRADE', 'REFUND');

-- Client
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "lastName" TEXT;
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "creditBalanceMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "defaultPaymentMethodId" TEXT;
ALTER TABLE "client" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
CREATE INDEX IF NOT EXISTS "client_stripeCustomerId_idx" ON "client"("stripeCustomerId");

-- Category
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
ALTER TABLE "category" ADD COLUMN IF NOT EXISTS "number" SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "category_number_key" ON "category"("number");
CREATE INDEX IF NOT EXISTS "category_parentId_idx" ON "category"("parentId");
DO $$ BEGIN
  ALTER TABLE "category" ADD CONSTRAINT "category_parentId_fkey"
    FOREIGN KEY ("parentId") REFERENCES "category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Product
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "hidden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "stock" INTEGER;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "perUserLimit" INTEGER;
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "allowQuantity" "AllowQuantity" NOT NULL DEFAULT 'NO';
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "number" SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "product_number_key" ON "product"("number");

-- Product upgrades
CREATE TABLE IF NOT EXISTS "product_upgrade" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetProductId" TEXT NOT NULL,
    CONSTRAINT "product_upgrade_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "product_upgrade_productId_targetProductId_key"
  ON "product_upgrade"("productId", "targetProductId");
DO $$ BEGIN
  ALTER TABLE "product_upgrade" ADD CONSTRAINT "product_upgrade_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "product_upgrade" ADD CONSTRAINT "product_upgrade_targetProductId_fkey"
    FOREIGN KEY ("targetProductId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Config option sort order
ALTER TABLE "config_option" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Order item config snapshot
ALTER TABLE "order_item" ADD COLUMN IF NOT EXISTS "config" JSONB NOT NULL DEFAULT '{}';

-- Invoice
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "isProforma" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "snapshot" JSONB;

-- Service quantity
ALTER TABLE "service" ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;

-- Coupon
ALTER TABLE "coupon" ADD COLUMN IF NOT EXISTS "maxUsesPerClient" INTEGER;
ALTER TABLE "coupon" ADD COLUMN IF NOT EXISTS "number" SERIAL;
CREATE UNIQUE INDEX IF NOT EXISTS "coupon_number_key" ON "coupon"("number");

-- Credits
CREATE TABLE IF NOT EXISTS "credit_transaction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "type" "CreditType" NOT NULL,
    "note" TEXT,
    "refType" TEXT,
    "refId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "credit_transaction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "credit_transaction_clientId_createdAt_idx"
  ON "credit_transaction"("clientId", "createdAt");
DO $$ BEGIN
  ALTER TABLE "credit_transaction" ADD CONSTRAINT "credit_transaction_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Email log
CREATE TABLE IF NOT EXISTS "email_log" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "email_log_createdAt_idx" ON "email_log"("createdAt");

-- Cart
CREATE TABLE IF NOT EXISTS "cart" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "guestKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "cart_guestKey_key" ON "cart"("guestKey");
CREATE INDEX IF NOT EXISTS "cart_clientId_idx" ON "cart"("clientId");
DO $$ BEGIN
  ALTER TABLE "cart" ADD CONSTRAINT "cart_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "cart_line" (
    "id" TEXT NOT NULL,
    "cartId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "planPriceMinor" INTEGER NOT NULL DEFAULT 0,
    "setupFeeMinor" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '[]',
    "lineTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "cart_line_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "cart_line_cartId_idx" ON "cart_line"("cartId");
DO $$ BEGIN
  ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_cartId_fkey"
    FOREIGN KEY ("cartId") REFERENCES "cart"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
