-- CreateEnum
CREATE TYPE "ConfigOptionType" AS ENUM ('TEXT', 'NUMBER', 'SELECT', 'RADIO', 'CHECKBOX', 'SLIDER');

-- CreateTable
CREATE TABLE "config_option" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "envKey" TEXT NOT NULL,
    "type" "ConfigOptionType" NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_option_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_option_product" (
    "id" TEXT NOT NULL,
    "configOptionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "config_option_product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_option_choice" (
    "id" TEXT NOT NULL,
    "configOptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "envKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pricingName" TEXT NOT NULL,
    "pricingType" "PlanType" NOT NULL DEFAULT 'FREE',
    "price" INTEGER NOT NULL DEFAULT 0,
    "intervalCount" INTEGER NOT NULL DEFAULT 1,
    "billingPeriod" "BillingPeriod" NOT NULL DEFAULT 'MONTH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_option_choice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "config_option_number_key" ON "config_option"("number");

-- CreateIndex
CREATE UNIQUE INDEX "config_option_product_configOptionId_productId_key" ON "config_option_product"("configOptionId", "productId");

-- AddForeignKey
ALTER TABLE "config_option_product" ADD CONSTRAINT "config_option_product_configOptionId_fkey" FOREIGN KEY ("configOptionId") REFERENCES "config_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_option_product" ADD CONSTRAINT "config_option_product_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_option_choice" ADD CONSTRAINT "config_option_choice_configOptionId_fkey" FOREIGN KEY ("configOptionId") REFERENCES "config_option"("id") ON DELETE CASCADE ON UPDATE CASCADE;
