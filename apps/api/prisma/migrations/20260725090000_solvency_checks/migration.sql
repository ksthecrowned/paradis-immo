-- CreateEnum
CREATE TYPE "SolvencyCheckStatus" AS ENUM (
  'PENDING',
  'GRANTED',
  'DENIED',
  'EXPIRED'
);

-- CreateTable
CREATE TABLE "SolvencyCheck" (
    "id" TEXT NOT NULL,
    "tenantUserId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterOrgId" TEXT NOT NULL,
    "status" "SolvencyCheckStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SolvencyCheck_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolvencyCheck_tenantUserId_status_idx" ON "SolvencyCheck"("tenantUserId", "status");

-- CreateIndex
CREATE INDEX "SolvencyCheck_requesterOrgId_tenantUserId_idx" ON "SolvencyCheck"("requesterOrgId", "tenantUserId");

-- AddForeignKey
ALTER TABLE "SolvencyCheck" ADD CONSTRAINT "SolvencyCheck_tenantUserId_fkey" FOREIGN KEY ("tenantUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolvencyCheck" ADD CONSTRAINT "SolvencyCheck_requesterOrgId_fkey" FOREIGN KEY ("requesterOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
