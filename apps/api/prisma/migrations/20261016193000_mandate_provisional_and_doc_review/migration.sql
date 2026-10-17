-- ADR-0001 / Lots 3–4 — initiateur, revue documentaire, accès provisoire (filtre applicatif).

CREATE TYPE "MandateInitiator" AS ENUM ('OWNER', 'AGENCY');

CREATE TYPE "MandateDocumentReviewStatus" AS ENUM (
  'NOT_APPLICABLE',
  'PENDING',
  'NEEDS_CORRECTION',
  'APPROVED',
  'REJECTED'
);

ALTER TABLE "Mandate"
  ADD COLUMN IF NOT EXISTS "initiator" "MandateInitiator" NOT NULL DEFAULT 'OWNER',
  ADD COLUMN IF NOT EXISTS "documentReviewStatus" "MandateDocumentReviewStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN IF NOT EXISTS "documentReviewReason" TEXT,
  ADD COLUMN IF NOT EXISTS "documentReviewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "documentReviewedById" TEXT,
  ADD COLUMN IF NOT EXISTS "documentVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "MandateDocumentReviewDecision" (
  "id" TEXT NOT NULL,
  "mandateId" TEXT NOT NULL,
  "decision" "MandateDocumentReviewStatus" NOT NULL,
  "reason" TEXT NOT NULL,
  "documentKey" TEXT,
  "documentVersion" INTEGER NOT NULL,
  "decidedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MandateDocumentReviewDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Mandate_documentReviewStatus_createdAt_idx"
  ON "Mandate"("documentReviewStatus", "createdAt");

CREATE INDEX "MandateDocumentReviewDecision_mandateId_createdAt_idx"
  ON "MandateDocumentReviewDecision"("mandateId", "createdAt");

ALTER TABLE "MandateDocumentReviewDecision"
  ADD CONSTRAINT "MandateDocumentReviewDecision_mandateId_fkey"
  FOREIGN KEY ("mandateId") REFERENCES "Mandate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
