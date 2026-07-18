-- CreateEnum
CREATE TYPE "CronRunKind" AS ENUM ('DAILY', 'SWEEP');

-- CreateEnum
CREATE TYPE "CronRunStatus" AS ENUM ('SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "cron_run" (
    "id" TEXT NOT NULL,
    "kind" "CronRunKind" NOT NULL,
    "status" "CronRunStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "invoicesCreated" INTEGER NOT NULL DEFAULT 0,
    "servicesSuspended" INTEGER NOT NULL DEFAULT 0,
    "servicesTerminated" INTEGER NOT NULL DEFAULT 0,
    "ticketsClosed" INTEGER NOT NULL DEFAULT 0,
    "invoicesCharged" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,

    CONSTRAINT "cron_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cron_run_kind_finishedAt_idx" ON "cron_run"("kind", "finishedAt");

-- CreateIndex
CREATE INDEX "cron_run_finishedAt_idx" ON "cron_run"("finishedAt");
