-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('AVAILABLE', 'SOLD', 'UNDER_OFFER', 'OCCUPIED', 'AVAILABLE_SOON');

-- AlterTable: add new columns
ALTER TABLE "Property" ADD COLUMN "listingStatus" "ListingStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "Property" ADD COLUMN "availableFrom" TIMESTAMP(3);
ALTER TABLE "Property" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from listingAvailability / unavailableReason
UPDATE "Property" SET "listingStatus" = 'AVAILABLE'
WHERE "listingAvailability" = 'AVAILABLE';

UPDATE "Property" SET "listingStatus" = 'SOLD'
WHERE "listingAvailability" = 'UNAVAILABLE' AND "unavailableReason" = 'SOLD';

UPDATE "Property" SET "listingStatus" = 'OCCUPIED'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RENTED'
  AND "mode" = 'RENT_LONG';

UPDATE "Property" SET "listingStatus" = 'UNDER_OFFER'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RESERVED'
  AND "mode" = 'SALE';

UPDATE "Property" SET "listingStatus" = 'AVAILABLE'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RESERVED'
  AND "mode" = 'RENT_SHORT';

UPDATE "Property" SET "listingStatus" = 'OCCUPIED'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RESERVED'
  AND "mode" = 'RENT_LONG';

UPDATE "Property" SET "listingStatus" = 'AVAILABLE'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RENTED'
  AND "mode" <> 'RENT_LONG';

-- Drop old columns
ALTER TABLE "Property" DROP COLUMN "unavailableReason";
ALTER TABLE "Property" DROP COLUMN "listingAvailability";

-- DropEnum
DROP TYPE "UnavailableReason";
DROP TYPE "ListingAvailability";
