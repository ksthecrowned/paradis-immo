-- CreateEnum
CREATE TYPE "BuyerPaymentProofStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "BuyerPaymentProof" (
    "id" TEXT NOT NULL,
    "saleAgreementId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterOrgId" TEXT NOT NULL,
    "status" "BuyerPaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BuyerPaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BuyerPaymentProof_saleAgreementId_status_idx" ON "BuyerPaymentProof"("saleAgreementId", "status");
CREATE INDEX "BuyerPaymentProof_buyerUserId_status_idx" ON "BuyerPaymentProof"("buyerUserId", "status");

ALTER TABLE "BuyerPaymentProof" ADD CONSTRAINT "BuyerPaymentProof_saleAgreementId_fkey" FOREIGN KEY ("saleAgreementId") REFERENCES "SaleAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyerPaymentProof" ADD CONSTRAINT "BuyerPaymentProof_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyerPaymentProof" ADD CONSTRAINT "BuyerPaymentProof_requesterOrgId_fkey" FOREIGN KEY ("requesterOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
