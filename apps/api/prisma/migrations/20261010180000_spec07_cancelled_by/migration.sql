-- Spec 07 — distinguer voyageur et hôte dans les annulations.
ALTER TYPE "BookingStatus" ADD VALUE 'CANCELLED_BY_GUEST';
ALTER TYPE "BookingStatus" ADD VALUE 'CANCELLED_BY_HOST';
