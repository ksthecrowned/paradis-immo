-- CreateEnum
CREATE TYPE "OrganizationRequestType" AS ENUM ('AGENCY', 'OWNER');

-- CreateEnum
CREATE TYPE "OrganizationRequestStatus" AS ENUM ('PENDING', 'INVITED', 'REJECTED');

-- CreateTable
CREATE TABLE "OrganizationRequest" (
    "id" TEXT NOT NULL,
    "type" "OrganizationRequestType" NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "rccm" TEXT,
    "niu" TEXT,
    "address" TEXT,
    "cityLabel" TEXT,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "description" TEXT,
    "submittedById" TEXT,
    "status" "OrganizationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrganizationRequest_status_createdAt_idx" ON "OrganizationRequest"("status", "createdAt");

