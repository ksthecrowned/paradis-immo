CREATE TYPE "SeekerIntent" AS ENUM ('RENT', 'BUY', 'VISIT', 'ALL_OPTIONS');
CREATE TYPE "SeekerExperience" AS ENUM ('FIRST_TIME', 'RETURNING', 'PRO');

ALTER TABLE "User"
  ADD COLUMN "seekerIntent" "SeekerIntent",
  ADD COLUMN "seekerExperience" "SeekerExperience",
  ADD COLUMN "budgetMinXaf" INTEGER,
  ADD COLUMN "budgetMaxXaf" INTEGER,
  ADD COLUMN "preferredQuartierIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "seekerSetupCompletedAt" TIMESTAMP(3);
