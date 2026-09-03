ALTER TABLE "Property" ADD COLUMN "minNights" INTEGER,
ADD COLUMN "maxNights" INTEGER,
ADD COLUMN "checkInTime" TEXT,
ADD COLUMN "checkOutTime" TEXT;

UPDATE "Property" SET "minNights" = 1 WHERE mode = 'RENT_SHORT' AND "minNights" IS NULL;
