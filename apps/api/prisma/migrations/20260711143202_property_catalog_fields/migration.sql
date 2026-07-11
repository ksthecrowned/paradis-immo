-- CreateEnum
CREATE TYPE "ListingAvailability" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "UnavailableReason" AS ENUM ('RENTED', 'SOLD', 'RESERVED');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "condition" TEXT,
ADD COLUMN     "features" JSONB,
ADD COLUMN     "floor" TEXT,
ADD COLUMN     "landTitle" TEXT,
ADD COLUMN     "listingAvailability" "ListingAvailability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "lotSize" DOUBLE PRECISION,
ADD COLUMN     "mapViews" JSONB,
ADD COLUMN     "orientation" TEXT,
ADD COLUMN     "parkingSpaces" INTEGER,
ADD COLUMN     "unavailableReason" "UnavailableReason",
ADD COLUMN     "yearBuilt" INTEGER;
