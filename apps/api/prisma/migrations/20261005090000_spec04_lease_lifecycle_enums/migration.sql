-- CreateEnum
CREATE TYPE "RentScheduleKind" AS ENUM ('RENT', 'DEPOSIT', 'CHARGES_ADJUSTMENT', 'LATE_FEE');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'SOLVENCY_PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "InspectionType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "ItemCondition" AS ENUM ('NEW', 'GOOD', 'WORN', 'DAMAGED', 'MISSING');

-- CreateEnum
CREATE TYPE "DepositDeductionStatus" AS ENUM ('PROPOSED', 'CONTESTED', 'ACCEPTED');

-- CreateEnum
CREATE TYPE "TerminationInitiator" AS ENUM ('TENANT', 'LANDLORD', 'MUTUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeaseStatus" ADD VALUE 'PENDING_SIGNATURE';
ALTER TYPE "LeaseStatus" ADD VALUE 'TERMINATING';
ALTER TYPE "LeaseStatus" ADD VALUE 'CANCELLED';

-- AlterEnum
ALTER TYPE "MandateActionType" ADD VALUE 'RENT_INCREASE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "RentScheduleStatus" ADD VALUE 'CANCELLED';
ALTER TYPE "RentScheduleStatus" ADD VALUE 'WAIVED';

