-- DropForeignKey
ALTER TABLE "Lease" DROP CONSTRAINT "Lease_tenantId_fkey";

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "autoRenew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "chargesAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "chargesMode" TEXT NOT NULL DEFAULT 'FLAT',
ADD COLUMN     "dueDay" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "indexationRate" DECIMAL(6,4),
ADD COLUMN     "invitedPhone" TEXT,
ADD COLUMN     "landlordSignedAt" TIMESTAMP(3),
ADD COLUMN     "landlordSignedById" TEXT,
ADD COLUMN     "lateFeeAfterDays" INTEGER,
ADD COLUMN     "lateFeeAmount" DECIMAL(12,2),
ADD COLUMN     "lateFeeRate" DECIMAL(6,4),
ADD COLUMN     "noticeMonthsLandlord" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "noticeMonthsTenant" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "tenantSignedAt" TIMESTAMP(3),
ADD COLUMN     "terminatedAt" TIMESTAMP(3),
ADD COLUMN     "terminationEffectiveAt" TIMESTAMP(3),
ADD COLUMN     "terminationInitiator" "TerminationInitiator",
ADD COLUMN     "terminationNoticeAt" TIMESTAMP(3),
ADD COLUMN     "terminationReason" TEXT,
ALTER COLUMN "tenantId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "issuerOrgId" TEXT;

-- AlterTable
ALTER TABLE "RentSchedule" ADD COLUMN     "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "chargesPart" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "kind" "RentScheduleKind" NOT NULL DEFAULT 'RENT',
ADD COLUMN     "lateFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3),
ADD COLUMN     "rentPart" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Backfill: existing rows were pure rent amounts (spec 04).
UPDATE "RentSchedule" SET "rentPart" = "amount";

-- AlterTable
ALTER TABLE "SolvencyCheck" ADD COLUMN     "applicationId" TEXT;

-- CreateTable
CREATE TABLE "RentReceipt" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "rentScheduleId" TEXT NOT NULL,
    "issuerOrgId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("organizationId","kind","year")
);

-- CreateTable
CREATE TABLE "RentalApplication" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "desiredMoveIn" TIMESTAMP(3) NOT NULL,
    "occupants" INTEGER NOT NULL,
    "occupation" TEXT,
    "declaredIncome" DECIMAL(12,2),
    "message" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "rejectionMessage" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "leaseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseTenant" (
    "leaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LeaseTenant_pkey" PRIMARY KEY ("leaseId","userId")
);

-- CreateTable
CREATE TABLE "LeaseAmendment" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "changes" JSONB NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "documentKey" TEXT,
    "tenantSignedAt" TIMESTAMP(3),
    "landlordSignedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseAmendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "performedById" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL,
    "meters" JSONB,
    "keys" JSONB,
    "generalComment" TEXT,
    "tenantSignedAt" TIMESTAMP(3),
    "managerSignedAt" TIMESTAMP(3),
    "reservesUntil" TIMESTAMP(3),
    "documentKey" TEXT,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionRoom" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "InspectionRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionItem" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "condition" "ItemCondition" NOT NULL,
    "comment" TEXT,
    "photoKeys" TEXT[],

    CONSTRAINT "InspectionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InspectionReserve" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "photoKeys" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionReserve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositDeduction" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "evidenceItemId" TEXT,
    "evidenceKeys" TEXT[],
    "status" "DepositDeductionStatus" NOT NULL DEFAULT 'PROPOSED',
    "tenantComment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepositDeduction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepositSettlement" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "heldAmount" DECIMAL(12,2) NOT NULL,
    "deducted" DECIMAL(12,2) NOT NULL,
    "refundAmount" DECIMAL(12,2) NOT NULL,
    "contestUntil" TIMESTAMP(3) NOT NULL,
    "payoutId" TEXT,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "DepositSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RentReceipt_number_key" ON "RentReceipt"("number");

-- CreateIndex
CREATE UNIQUE INDEX "RentReceipt_rentScheduleId_key" ON "RentReceipt"("rentScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalApplication_leaseId_key" ON "RentalApplication"("leaseId");

-- CreateIndex
CREATE UNIQUE INDEX "RentalApplication_propertyId_applicantId_key" ON "RentalApplication"("propertyId", "applicantId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseAmendment_leaseId_version_key" ON "LeaseAmendment"("leaseId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_leaseId_type_key" ON "Inspection"("leaseId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DepositSettlement_leaseId_key" ON "DepositSettlement"("leaseId");

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvencyCheck" ADD CONSTRAINT "SolvencyCheck_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "RentalApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentReceipt" ADD CONSTRAINT "RentReceipt_rentScheduleId_fkey" FOREIGN KEY ("rentScheduleId") REFERENCES "RentSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalApplication" ADD CONSTRAINT "RentalApplication_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalApplication" ADD CONSTRAINT "RentalApplication_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalApplication" ADD CONSTRAINT "RentalApplication_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseTenant" ADD CONSTRAINT "LeaseTenant_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseTenant" ADD CONSTRAINT "LeaseTenant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseAmendment" ADD CONSTRAINT "LeaseAmendment_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseTemplate" ADD CONSTRAINT "LeaseTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionRoom" ADD CONSTRAINT "InspectionRoom_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionItem" ADD CONSTRAINT "InspectionItem_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "InspectionRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InspectionReserve" ADD CONSTRAINT "InspectionReserve_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositDeduction" ADD CONSTRAINT "DepositDeduction_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepositSettlement" ADD CONSTRAINT "DepositSettlement_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

