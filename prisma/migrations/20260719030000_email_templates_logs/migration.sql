-- AlterTable
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "from" TEXT NOT NULL DEFAULT '';
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "templateKey" TEXT;
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "html" TEXT;
ALTER TABLE "email_log" ADD COLUMN IF NOT EXISTS "error" TEXT;

CREATE INDEX IF NOT EXISTS "email_log_status_idx" ON "email_log"("status");

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "EmailBodyFormat" AS ENUM ('markdown', 'html');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "email_template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "subject" TEXT NOT NULL,
    "bodyFormat" "EmailBodyFormat" NOT NULL DEFAULT 'markdown',
    "body" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_template_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "email_template_key_key" ON "email_template"("key");
