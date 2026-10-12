-- Spec 06 P2 — plages d'indisponibilité pour les visites.
CREATE TABLE "VisitBlackout" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitBlackout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VisitBlackout_propertyId_startsAt_idx" ON "VisitBlackout"("propertyId", "startsAt");

ALTER TABLE "VisitBlackout" ADD CONSTRAINT "VisitBlackout_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
