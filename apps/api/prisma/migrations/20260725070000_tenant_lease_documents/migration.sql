-- CreateEnum
CREATE TYPE "TenantDocumentType" AS ENUM ('ID_CARD', 'PASSPORT', 'OTHER_ID');

-- CreateEnum
CREATE TYPE "LeaseDocumentType" AS ENUM ('SIGNED_LEASE', 'AMENDMENT', 'OTHER_LEASE');

-- CreateTable
CREATE TABLE "TenantDocument" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TenantDocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseDocument" (
    "id" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "type" "LeaseDocumentType" NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantDocument_userId_idx" ON "TenantDocument"("userId");

-- CreateIndex
CREATE INDEX "LeaseDocument_leaseId_idx" ON "LeaseDocument"("leaseId");

-- AddForeignKey
ALTER TABLE "TenantDocument" ADD CONSTRAINT "TenantDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseDocument" ADD CONSTRAINT "LeaseDocument_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
