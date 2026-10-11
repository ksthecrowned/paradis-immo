CREATE TABLE "VisitReport" (
    "id" TEXT NOT NULL,
    "visitBookingId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "interestLevel" INTEGER,
    "notes" TEXT,
    "nextStep" TEXT,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VisitReport_visitBookingId_key" ON "VisitReport"("visitBookingId");
CREATE INDEX "VisitReport_authorId_idx" ON "VisitReport"("authorId");

ALTER TABLE "VisitReport"
    ADD CONSTRAINT "VisitReport_visitBookingId_fkey"
    FOREIGN KEY ("visitBookingId") REFERENCES "VisitBooking"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VisitReport"
    ADD CONSTRAINT "VisitReport_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
