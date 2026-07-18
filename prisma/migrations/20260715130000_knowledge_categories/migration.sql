-- CreateTable
CREATE TABLE "knowledge_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_category_slug_key" ON "knowledge_category"("slug");

-- CreateIndex
CREATE INDEX "knowledge_category_parentId_sortOrder_idx" ON "knowledge_category"("parentId", "sortOrder");

-- AddForeignKey
ALTER TABLE "knowledge_category" ADD CONSTRAINT "knowledge_category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "knowledge_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "knowledge_article" ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "categoryId" TEXT;

-- CreateIndex
CREATE INDEX "knowledge_article_categoryId_sortOrder_idx" ON "knowledge_article"("categoryId", "sortOrder");

-- AddForeignKey
ALTER TABLE "knowledge_article" ADD CONSTRAINT "knowledge_article_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "knowledge_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill publishedAt for already-published articles
UPDATE "knowledge_article" SET "publishedAt" = "createdAt" WHERE "published" = true AND "publishedAt" IS NULL;
