-- CreateEnum
CREATE TYPE "MandateScope" AS ENUM ('LONG_TERM_RENTAL', 'SHORT_STAY', 'SALE');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PAID');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('RENT_IN', 'DEPOSIT_IN', 'DEPOSIT_OUT', 'FEE', 'EXPENSE', 'PAYOUT', 'ADJUSTMENT', 'REFUND', 'STAY_IN', 'SALE_IN');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "ApprovalStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MandateActionType" ADD VALUE 'SALE_PRICE';
ALTER TYPE "MandateActionType" ADD VALUE 'SALE_OFFER_ACCEPT';
ALTER TYPE "MandateActionType" ADD VALUE 'EXPENSE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MandateStatus" ADD VALUE 'PROPOSED';
ALTER TYPE "MandateStatus" ADD VALUE 'COUNTERED';
ALTER TYPE "MandateStatus" ADD VALUE 'TERMINATING';
ALTER TYPE "MandateStatus" ADD VALUE 'TERMINATED';
ALTER TYPE "MandateStatus" ADD VALUE 'EXPIRED';
ALTER TYPE "MandateStatus" ADD VALUE 'DECLINED';

-- AlterTable
ALTER TABLE "Mandate" ADD COLUMN     "acceptedAt" TIMESTAMP(3),
ADD COLUMN     "acceptedById" TEXT,
ADD COLUMN     "agencySignedAt" TIMESTAMP(3),
ADD COLUMN     "approvalTtlDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "exclusive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "leaseSignRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lettingFee" DECIMAL(12,2),
ADD COLUMN     "lettingFeeMonths" DECIMAL(6,2),
ADD COLUMN     "managementFeeRate" DECIMAL(8,4),
ADD COLUMN     "minSalePrice" DECIMAL(12,2),
ADD COLUMN     "noticeDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "ownerSignedAt" TIMESTAMP(3),
ADD COLUMN     "rentChangeRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "repairApprovalThreshold" DECIMAL(12,2),
ADD COLUMN     "saleCommissionRate" DECIMAL(8,4),
ADD COLUMN     "scopes" "MandateScope"[],
ADD COLUMN     "signedDocumentKey" TEXT,
ADD COLUMN     "stayCommissionRate" DECIMAL(8,4),
ADD COLUMN     "tacitRenewal" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "terminatedById" TEXT,
ADD COLUMN     "terminationEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "terminationReason" TEXT,
ADD COLUMN     "terminationRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MandateApproval" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "sourceId" TEXT,
ADD COLUMN     "sourceType" TEXT;

-- Spec 03 — required columns added as nullable first so the migration works
-- on non-empty tables, then backfilled from existing data.
ALTER TABLE "Mandate" ADD COLUMN "proposedById" TEXT;
UPDATE "Mandate" m
SET "proposedById" = p."ownerId"
FROM "Property" p
WHERE m."propertyId" = p.id AND m."proposedById" IS NULL;
ALTER TABLE "Mandate" ALTER COLUMN "proposedById" SET NOT NULL;

ALTER TABLE "MandateApproval" ADD COLUMN "requestedById" TEXT;
ALTER TABLE "MandateApproval" ADD COLUMN "expiresAt" TIMESTAMP(3);
UPDATE "MandateApproval" a
SET "requestedById" = m."proposedById",
    "expiresAt" = a."createdAt" + INTERVAL '7 days'
FROM "Mandate" m
WHERE a."mandateId" = m.id
  AND (a."requestedById" IS NULL OR a."expiresAt" IS NULL);
ALTER TABLE "MandateApproval" ALTER COLUMN "requestedById" SET NOT NULL;
ALTER TABLE "MandateApproval" ALTER COLUMN "expiresAt" SET NOT NULL;

-- CreateTable
CREATE TABLE "MandateVersion" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT NOT NULL,
    "terms" JSONB NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MandateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "mandateId" TEXT,
    "ticketId" TEXT,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "invoiceKey" TEXT,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "mandateId" TEXT,
    "ownerOrgId" TEXT NOT NULL,
    "agencyOrgId" TEXT,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "reversesId" TEXT,
    "label" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OwnerStatement" (
    "id" TEXT NOT NULL,
    "mandateId" TEXT,
    "ownerOrgId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "totals" JSONB NOT NULL,
    "fileKey" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OwnerStatement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MandateVersion_mandateId_createdAt_idx" ON "MandateVersion"("mandateId", "createdAt");

-- CreateIndex
CREATE INDEX "Expense_propertyId_status_idx" ON "Expense"("propertyId", "status");

-- CreateIndex
CREATE INDEX "LedgerEntry_ownerOrgId_occurredAt_idx" ON "LedgerEntry"("ownerOrgId", "occurredAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_mandateId_occurredAt_idx" ON "LedgerEntry"("mandateId", "occurredAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_propertyId_occurredAt_idx" ON "LedgerEntry"("propertyId", "occurredAt");

-- CreateIndex
CREATE INDEX "OwnerStatement_ownerOrgId_periodStart_idx" ON "OwnerStatement"("ownerOrgId", "periodStart");

-- CreateIndex
CREATE INDEX "MandateApproval_status_expiresAt_idx" ON "MandateApproval"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "MandateVersion" ADD CONSTRAINT "MandateVersion_mandateId_fkey" FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

