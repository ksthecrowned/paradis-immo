-- Specs 06/07 — visit hold states and short-stay pricing quote.

-- AlterEnum: extend visit statuses (add values).
ALTER TYPE "VisitSlotStatus" ADD VALUE 'HELD';
ALTER TYPE "VisitSlotStatus" ADD VALUE 'FULL';

ALTER TYPE "VisitBookingStatus" ADD VALUE 'COMPLETED_UNCONFIRMED';
ALTER TYPE "VisitBookingStatus" ADD VALUE 'EXPIRED';

-- AlterEnum: extend booking statuses (add values).
ALTER TYPE "BookingStatus" ADD VALUE 'PENDING_PAYMENT';
ALTER TYPE "BookingStatus" ADD VALUE 'REQUESTED';
ALTER TYPE "BookingStatus" ADD VALUE 'ACCEPTED';
ALTER TYPE "BookingStatus" ADD VALUE 'DECLINED';
ALTER TYPE "BookingStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "BookingStatus" ADD VALUE 'CHECKED_OUT';
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "VisitBooking" ADD COLUMN     "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN     "priceAmount" DECIMAL(12,2),
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "guests" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "priceBreakdown" JSONB,
ADD COLUMN     "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN     "requestExpiresAt" TIMESTAMP(3),
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "cancellationPolicy" TEXT,
ADD COLUMN     "cancelledById" TEXT,
ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "refundAmount" DECIMAL(12,2),
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkedOutAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Booking_propertyId_status_idx" ON "Booking"("propertyId", "status");

-- CreateTable
CREATE TABLE "StayListingSettings" (
    "propertyId" TEXT NOT NULL,
    "baseNightlyRate" DECIMAL(12,2) NOT NULL,
    "weekendNightlyRate" DECIMAL(12,2),
    "weeklyDiscount" DECIMAL(4,2),
    "monthlyDiscount" DECIMAL(4,2),
    "cleaningFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "baseGuests" INTEGER NOT NULL DEFAULT 2,
    "maxGuests" INTEGER NOT NULL DEFAULT 4,
    "extraGuestFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "maxNights" INTEGER NOT NULL DEFAULT 90,
    "advanceNoticeHours" INTEGER NOT NULL DEFAULT 24,
    "bookingWindowDays" INTEGER NOT NULL DEFAULT 365,
    "instantBook" BOOLEAN NOT NULL DEFAULT true,
    "cancellationPolicy" TEXT NOT NULL DEFAULT 'MODERATE',
    "depositMode" TEXT NOT NULL DEFAULT 'NONE',
    "depositAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "serviceFeeRate" DECIMAL(4,2) NOT NULL DEFAULT 0.07,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StayListingSettings_pkey" PRIMARY KEY ("propertyId")
);

-- CreateTable
CREATE TABLE "SeasonalRate" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "nightlyRate" DECIMAL(12,2) NOT NULL,
    "minNights" INTEGER,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeasonalRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SeasonalRate_propertyId_startDate_idx" ON "SeasonalRate"("propertyId", "startDate");

-- AddForeignKey
ALTER TABLE "StayListingSettings" ADD CONSTRAINT "StayListingSettings_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonalRate" ADD CONSTRAINT "SeasonalRate_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
