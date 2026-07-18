-- AlterTable
ALTER TABLE "client" ADD COLUMN "number" SERIAL;

-- AlterTable
ALTER TABLE "order" ADD COLUMN "number" SERIAL;

-- AlterTable
ALTER TABLE "service" ADD COLUMN "number" SERIAL;

-- AlterTable
ALTER TABLE "payment" ADD COLUMN "number" SERIAL;

-- AlterTable
ALTER TABLE "knowledge_category" ADD COLUMN "number" SERIAL;

-- AlterTable
ALTER TABLE "knowledge_article" ADD COLUMN "number" SERIAL;

-- CreateIndex
CREATE UNIQUE INDEX "client_number_key" ON "client"("number");

-- CreateIndex
CREATE UNIQUE INDEX "order_number_key" ON "order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "service_number_key" ON "service"("number");

-- CreateIndex
CREATE UNIQUE INDEX "payment_number_key" ON "payment"("number");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_category_number_key" ON "knowledge_category"("number");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_article_number_key" ON "knowledge_article"("number");
