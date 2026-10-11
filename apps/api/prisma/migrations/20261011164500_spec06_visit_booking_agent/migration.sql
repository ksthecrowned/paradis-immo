ALTER TABLE "VisitBooking"
ADD COLUMN "agentId" TEXT;

ALTER TABLE "VisitBooking"
ADD COLUMN "agentOrganizationId" TEXT;

CREATE INDEX "VisitBooking_agentOrganizationId_agentId_status_idx"
ON "VisitBooking"("agentOrganizationId", "agentId", "status");

ALTER TABLE "VisitBooking"
ADD CONSTRAINT "VisitBooking_agentId_fkey"
FOREIGN KEY ("agentId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "VisitBooking"
ADD CONSTRAINT "VisitBooking_agentOrganizationId_fkey"
FOREIGN KEY ("agentOrganizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
