-- Listing fees on public property cards
ALTER TABLE "Property" ADD COLUMN "depositMonths" INTEGER;
ALTER TABLE "Property" ADD COLUMN "agencyFeeAmount" DECIMAL(12, 2);
