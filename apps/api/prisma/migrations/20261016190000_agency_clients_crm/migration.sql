-- Spec 02.5 / ADR-0001 — CRM clients d'agence, propriétaire externe, audit de changement.
-- Additive + compatible : pas de backfill CRM, pas de mutation des mandats historiques.

CREATE TYPE "AgencyClientLinkStatus" AS ENUM (
  'UNLINKED',
  'CLAIM_PENDING',
  'LINKED',
  'CLAIM_DECLINED'
);

CREATE TYPE "AgencyClientClaimStatus" AS ENUM (
  'PENDING',
  'CONFIRMED',
  'DECLINED',
  'EXPIRED'
);

CREATE TABLE "AgencyClient" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "displayName" TEXT NOT NULL,
  "phoneE164" TEXT,
  "email" TEXT,
  "internalNote" TEXT,
  "linkStatus" "AgencyClientLinkStatus" NOT NULL DEFAULT 'UNLINKED',
  "archivedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencyClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AgencyClientClaim" (
  "id" TEXT NOT NULL,
  "agencyClientId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "AgencyClientClaimStatus" NOT NULL DEFAULT 'PENDING',
  "phoneVerifiedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgencyClientClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyOwnerChangeLog" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "fromAgencyClientId" TEXT,
  "toAgencyClientId" TEXT,
  "fromOwnerId" TEXT,
  "toOwnerId" TEXT,
  "changedById" TEXT NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PropertyOwnerChangeLog_pkey" PRIMARY KEY ("id")
);

-- Property: ownerId nullable + agencyClientId
ALTER TABLE "Property" ALTER COLUMN "ownerId" DROP NOT NULL;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "agencyClientId" TEXT;

CREATE INDEX "AgencyClient_organizationId_archivedAt_idx"
  ON "AgencyClient"("organizationId", "archivedAt");
CREATE INDEX "AgencyClient_organizationId_linkStatus_idx"
  ON "AgencyClient"("organizationId", "linkStatus");
CREATE INDEX "AgencyClient_phoneE164_idx" ON "AgencyClient"("phoneE164");
CREATE INDEX "AgencyClient_userId_idx" ON "AgencyClient"("userId");

-- Une relation active par téléphone normalisé et par compte, dans une agence.
CREATE UNIQUE INDEX "AgencyClient_organizationId_phoneE164_active_key"
  ON "AgencyClient"("organizationId", "phoneE164")
  WHERE "archivedAt" IS NULL AND "phoneE164" IS NOT NULL;

CREATE UNIQUE INDEX "AgencyClient_organizationId_userId_active_key"
  ON "AgencyClient"("organizationId", "userId")
  WHERE "archivedAt" IS NULL AND "userId" IS NOT NULL;

CREATE INDEX "AgencyClientClaim_agencyClientId_status_idx"
  ON "AgencyClientClaim"("agencyClientId", "status");
CREATE INDEX "AgencyClientClaim_userId_status_idx"
  ON "AgencyClientClaim"("userId", "status");
CREATE INDEX "AgencyClientClaim_expiresAt_idx" ON "AgencyClientClaim"("expiresAt");

CREATE INDEX "Property_agencyClientId_idx" ON "Property"("agencyClientId");
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");
CREATE INDEX "PropertyOwnerChangeLog_propertyId_createdAt_idx"
  ON "PropertyOwnerChangeLog"("propertyId", "createdAt");

ALTER TABLE "AgencyClient"
  ADD CONSTRAINT "AgencyClient_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AgencyClient"
  ADD CONSTRAINT "AgencyClient_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgencyClient"
  ADD CONSTRAINT "AgencyClient_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AgencyClientClaim"
  ADD CONSTRAINT "AgencyClientClaim_agencyClientId_fkey"
  FOREIGN KEY ("agencyClientId") REFERENCES "AgencyClient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AgencyClientClaim"
  ADD CONSTRAINT "AgencyClientClaim_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Property"
  ADD CONSTRAINT "Property_agencyClientId_fkey"
  FOREIGN KEY ("agencyClientId") REFERENCES "AgencyClient"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Au moins une identité propriétaire (User et/ou CRM). Les lignes existantes ont ownerId.
ALTER TABLE "Property"
  ADD CONSTRAINT "Property_owner_identity_check"
  CHECK ("ownerId" IS NOT NULL OR "agencyClientId" IS NOT NULL);

ALTER TABLE "PropertyOwnerChangeLog"
  ADD CONSTRAINT "PropertyOwnerChangeLog_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PropertyOwnerChangeLog"
  ADD CONSTRAINT "PropertyOwnerChangeLog_fromAgencyClientId_fkey"
  FOREIGN KEY ("fromAgencyClientId") REFERENCES "AgencyClient"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PropertyOwnerChangeLog"
  ADD CONSTRAINT "PropertyOwnerChangeLog_toAgencyClientId_fkey"
  FOREIGN KEY ("toAgencyClientId") REFERENCES "AgencyClient"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PropertyOwnerChangeLog"
  ADD CONSTRAINT "PropertyOwnerChangeLog_changedById_fkey"
  FOREIGN KEY ("changedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
