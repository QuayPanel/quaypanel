-- AlterTable
ALTER TABLE "affiliate_referral" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "affiliate_referral_invoiceId_key" ON "affiliate_referral"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "affiliate_referral_orderId_idx" ON "affiliate_referral"("orderId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'affiliate_referral_invoiceId_fkey'
  ) THEN
    ALTER TABLE "affiliate_referral"
      ADD CONSTRAINT "affiliate_referral_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
