-- Spec 08 — demande d'achat : budget déclaré + téléphone de contact.
ALTER TABLE "SaleInquiry" ADD COLUMN "budget" DECIMAL(12,2);
ALTER TABLE "SaleInquiry" ADD COLUMN "phone" TEXT;
