-- AlterTable
ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "OrganizationReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "propertyTitle" TEXT,
    "body" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OrganizationReview_organizationId_createdAt_idx" ON "OrganizationReview"("organizationId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "OrganizationReview"
    ADD CONSTRAINT "OrganizationReview_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
