-- CreateEnum
CREATE TYPE "PropertyReportReason" AS ENUM (
  'ALREADY_SOLD_OR_RENTED',
  'FRAUDULENT',
  'DUPLICATE',
  'INCORRECT_INFO',
  'INAPPROPRIATE',
  'OTHER'
);

-- CreateEnum
CREATE TYPE "PropertyReportStatus" AS ENUM (
  'OPEN',
  'REVIEWED',
  'DISMISSED',
  'ACTIONED'
);

-- CreateTable
CREATE TABLE "PropertyReport" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reporterKey" TEXT NOT NULL,
    "reason" "PropertyReportReason" NOT NULL,
    "description" TEXT,
    "status" "PropertyReportStatus" NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PropertyReport_status_createdAt_idx" ON "PropertyReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PropertyReport_propertyId_idx" ON "PropertyReport"("propertyId");

-- AddForeignKey
ALTER TABLE "PropertyReport" ADD CONSTRAINT "PropertyReport_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
