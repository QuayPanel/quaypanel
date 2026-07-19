-- Enums required by product_plan and config_option_choice (were in schema but never migrated)
CREATE TYPE "PlanType" AS ENUM ('FREE', 'ONE_TIME', 'RECURRING');
CREATE TYPE "BillingPeriod" AS ENUM ('DAY', 'WEEK', 'MONTH', 'YEAR');

-- Align product_plan with current schema
ALTER TABLE "product_plan" ADD COLUMN IF NOT EXISTS "priceFormula" TEXT;
ALTER TABLE "product_plan" ADD COLUMN IF NOT EXISTS "type" "PlanType" NOT NULL DEFAULT 'RECURRING';
ALTER TABLE "product_plan" ADD COLUMN IF NOT EXISTS "intervalCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "product_plan" ADD COLUMN IF NOT EXISTS "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTH';
ALTER TABLE "product_plan" ADD COLUMN IF NOT EXISTS "setupFee" INTEGER NOT NULL DEFAULT 0;
