-- Spec 15 B2 — AdminProfile (RBAC fin admin). Idempotent.
DO $$ BEGIN
  CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'OPS', 'FINANCE', 'READ_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AdminProfile" (
    "userId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "ipAllowlist" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminProfile_pkey" PRIMARY KEY ("userId")
);
CREATE INDEX IF NOT EXISTS "AdminProfile_role_idx" ON "AdminProfile"("role");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdminProfile_userId_fkey') THEN
    ALTER TABLE "AdminProfile" ADD CONSTRAINT "AdminProfile_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
