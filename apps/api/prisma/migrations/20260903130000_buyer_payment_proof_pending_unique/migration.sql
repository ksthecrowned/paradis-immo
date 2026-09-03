-- Prisma schema does not support partial unique indexes.
CREATE UNIQUE INDEX "BuyerPaymentProof_one_pending_per_agreement_idx"
ON "BuyerPaymentProof" ("saleAgreementId")
WHERE "status" = 'PENDING';
