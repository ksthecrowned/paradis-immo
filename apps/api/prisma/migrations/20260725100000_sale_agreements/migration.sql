-- AlterEnum
ALTER TYPE "AllocatableType" ADD VALUE 'SALE_INSTALLMENT';

-- CreateEnum
CREATE TYPE "SaleAgreementStatus" AS ENUM (
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED'
);

-- CreateEnum
CREATE TYPE "SaleInstallmentStatus" AS ENUM (
  'PENDING',
  'PAID',
  'OVERDUE',
  'PARTIAL'
);

-- CreateTable
CREATE TABLE "SaleAgreement" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "saleInquiryId" TEXT,
    "agreedPrice" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "SaleAgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaleAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleInstallment" (
    "id" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "label" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "SaleInstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleAgreement_saleInquiryId_key" ON "SaleAgreement"("saleInquiryId");

-- CreateIndex
CREATE INDEX "SaleAgreement_buyerId_status_idx" ON "SaleAgreement"("buyerId", "status");

-- CreateIndex
CREATE INDEX "SaleAgreement_propertyId_status_idx" ON "SaleAgreement"("propertyId", "status");

-- CreateIndex
CREATE INDEX "SaleAgreement_organizationId_idx" ON "SaleAgreement"("organizationId");

-- CreateIndex
CREATE INDEX "SaleInstallment_agreementId_position_idx" ON "SaleInstallment"("agreementId", "position");

-- AddForeignKey
ALTER TABLE "SaleAgreement" ADD CONSTRAINT "SaleAgreement_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAgreement" ADD CONSTRAINT "SaleAgreement_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAgreement" ADD CONSTRAINT "SaleAgreement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAgreement" ADD CONSTRAINT "SaleAgreement_saleInquiryId_fkey" FOREIGN KEY ("saleInquiryId") REFERENCES "SaleInquiry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleInstallment" ADD CONSTRAINT "SaleInstallment_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "SaleAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
