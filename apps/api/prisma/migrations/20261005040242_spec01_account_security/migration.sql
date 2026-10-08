-- Spec 01 — compte, sessions, sécurité.
--
-- Hand-adjusted: Prisma's generator emitted plain `ADD COLUMN ... NOT NULL`
-- for familyId/deviceId, which fails on a non-empty RefreshToken table
-- (it ignored @default(dbgenerated(...))). The columns are therefore added
-- nullable, backfilled, then tightened.

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "DevicePlatform" AS ENUM ('IOS', 'ANDROID', 'WEB', 'ADMIN');

-- AlterTable
ALTER TABLE "OtpChallenge" ADD COLUMN     "lastSentAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- AlterTable: RefreshToken — add nullable, backfill, then constrain.
ALTER TABLE "RefreshToken" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "deviceName" TEXT,
ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "platform" "DevicePlatform" NOT NULL DEFAULT 'WEB',
ADD COLUMN     "userAgent" TEXT;

UPDATE "RefreshToken"
SET "deviceId" = gen_random_uuid(),
    "familyId" = gen_random_uuid()
WHERE "deviceId" IS NULL
   OR "familyId" IS NULL;

ALTER TABLE "RefreshToken"
    ALTER COLUMN "deviceId" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "familyId" SET DEFAULT gen_random_uuid(),
    ALTER COLUMN "deviceId" SET NOT NULL,
    ALTER COLUMN "familyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT,
ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- CreateTable
CREATE TABLE "RateLimitCounter" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "windowEndAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitCounter_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");
