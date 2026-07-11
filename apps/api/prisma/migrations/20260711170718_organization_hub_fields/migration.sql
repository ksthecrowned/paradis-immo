-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "address" TEXT,
ADD COLUMN     "cityLabel" TEXT,
ADD COLUMN     "dealSuccessPercent" INTEGER,
ADD COLUMN     "foundedYear" INTEGER,
ADD COLUMN     "isOfficial" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "logoColor" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "rating" DOUBLE PRECISION,
ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shortName" TEXT,
ADD COLUMN     "tagline" TEXT,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;
