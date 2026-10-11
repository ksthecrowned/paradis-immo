-- Spec 08 P1 — offres d'achat et contre-offres (idempotent : le premier
-- deploy a partiellement appliqué cette migration avant d'échouer sur la
-- colonne déjà existante).
DO $$ BEGIN
  CREATE TYPE "FinancingType" AS ENUM ('CASH', 'INSTALLMENTS', 'BANK_LOAN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SaleOfferStatus" AS ENUM ('SUBMITTED', 'FORWARDED', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'EXPIRED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SaleOffer" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "inquiryId" TEXT,
    "buyerId" TEXT NOT NULL,
    "parentOfferId" TEXT,
    "authorSide" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "financing" "FinancingType" NOT NULL,
    "depositAmount" DECIMAL(12,2),
    "installmentsCount" INTEGER,
    "conditions" TEXT,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "SaleOfferStatus" NOT NULL DEFAULT 'SUBMITTED',
    "approvalId" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SaleOffer_propertyId_status_idx" ON "SaleOffer"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "SaleOffer_buyerId_status_idx" ON "SaleOffer"("buyerId", "status");
CREATE INDEX IF NOT EXISTS "SaleOffer_inquiryId_idx" ON "SaleOffer"("inquiryId");
CREATE INDEX IF NOT EXISTS "SaleOffer_parentOfferId_idx" ON "SaleOffer"("parentOfferId");

-- AddForeignKey (idempotent via to_regclass check)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SaleOffer_propertyId_fkey'
  ) THEN
    ALTER TABLE "SaleOffer" ADD CONSTRAINT "SaleOffer_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SaleOffer_inquiryId_fkey'
  ) THEN
    ALTER TABLE "SaleOffer" ADD CONSTRAINT "SaleOffer_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "SaleInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SaleOffer_buyerId_fkey'
  ) THEN
    ALTER TABLE "SaleOffer" ADD CONSTRAINT "SaleOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SaleOffer_parentOfferId_fkey'
  ) THEN
    ALTER TABLE "SaleOffer" ADD CONSTRAINT "SaleOffer_parentOfferId_fkey" FOREIGN KEY ("parentOfferId") REFERENCES "SaleOffer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
  END IF;
END $$;
