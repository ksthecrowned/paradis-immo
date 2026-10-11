-- Spec 15 blocs A1 + A3 : statuts maintenance étendus, machine à états,
-- audit log. Idempotent (le style des migrations précédentes est suivi).
DO $$ BEGIN
  CREATE TYPE "ChargeTo" AS ENUM ('OWNER', 'TENANT', 'AGENCY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MaintenanceCategory" AS ENUM ('PLUMBING', 'ELECTRICAL', 'LOCKSMITH', 'HVAC', 'PESTS', 'STRUCTURE', 'APPLIANCE', 'GENERATOR', 'WATER_SUPPLY', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Étendre l'enum MaintenanceStatus (les valeurs existantes OPEN, ASSIGNED,
-- IN_PROGRESS, DONE, CLOSED restent ; on ajoute les nouvelles).
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'TRIAGED';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'AWAITING_QUOTE';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'AWAITING_APPROVAL';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'RESOLVED';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'REOPENED';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "MaintenanceStatus" ADD VALUE IF NOT EXISTS 'SCHEDULED';

-- Colonnes Machine à états sur MaintenanceTicket
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "leaseId" TEXT;
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "bookingId" TEXT;
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "category" "MaintenanceCategory" NOT NULL DEFAULT 'OTHER';
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "availability" TEXT;
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "entryPermission" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "slaDueAt" TIMESTAMP(3);
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "actualCost" DECIMAL(12,2);
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "chargeTo" "ChargeTo" NOT NULL DEFAULT 'OWNER';
ALTER TABLE "MaintenanceTicket" ADD COLUMN IF NOT EXISTS "cancelReason" TEXT;

CREATE INDEX IF NOT EXISTS "MaintenanceTicket_propertyId_status_idx" ON "MaintenanceTicket"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "MaintenanceTicket_reporterId_status_idx" ON "MaintenanceTicket"("reporterId", "status");

-- Journal des transitions
CREATE TABLE IF NOT EXISTS "MaintenanceStatusChange" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "from" "MaintenanceStatus" NOT NULL,
    "to" "MaintenanceStatus" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceStatusChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MaintenanceStatusChange_ticketId_createdAt_idx"
  ON "MaintenanceStatusChange"("ticketId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceStatusChange_ticketId_fkey') THEN
    ALTER TABLE "MaintenanceStatusChange" ADD CONSTRAINT "MaintenanceStatusChange_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Commentaires
CREATE TABLE IF NOT EXISTS "MaintenanceComment" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceComment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MaintenanceComment_ticketId_createdAt_idx"
  ON "MaintenanceComment"("ticketId", "createdAt");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceComment_ticketId_fkey') THEN
    ALTER TABLE "MaintenanceComment" ADD CONSTRAINT "MaintenanceComment_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "MaintenanceTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Audit log
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'ADMIN',
    "impersonatedBy" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
