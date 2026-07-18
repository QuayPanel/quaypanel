-- AlterTable
ALTER TABLE "knowledge_article" ADD COLUMN "shortDescription" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "knowledge_article" ALTER COLUMN "published" SET DEFAULT false;
