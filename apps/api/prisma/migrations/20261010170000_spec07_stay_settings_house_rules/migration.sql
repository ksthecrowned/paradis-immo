-- Spec 07 — heures d'arrivée/départ + règles de maison sur StayListingSettings.
ALTER TABLE "StayListingSettings" ADD COLUMN "checkInFrom" TEXT NOT NULL DEFAULT '14:00';
ALTER TABLE "StayListingSettings" ADD COLUMN "checkOutBefore" TEXT NOT NULL DEFAULT '11:00';
ALTER TABLE "StayListingSettings" ADD COLUMN "houseRules" TEXT;
ALTER TABLE "StayListingSettings" ADD COLUMN "arrivalInstructions" TEXT;
