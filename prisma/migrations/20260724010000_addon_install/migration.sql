-- CreateTable
CREATE TABLE "addon_install" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL DEFAULT '{}',
    "version" TEXT,
    "discoveredPath" TEXT,
    "loadError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addon_install_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "addon_install_kind_enabled_idx" ON "addon_install"("kind", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "addon_install_kind_addonId_key" ON "addon_install"("kind", "addonId");
