CREATE TYPE "NotificationCategory" AS ENUM (
  'PAYMENTS',
  'VISITS',
  'STAYS',
  'SALES',
  'MAINTENANCE',
  'MESSAGES',
  'MANDATES',
  'LEASES',
  'ACCOUNT',
  'MARKETING'
);

CREATE TABLE "NotificationPreference" (
  "userId" TEXT NOT NULL,
  "category" "NotificationCategory" NOT NULL,
  "push" BOOLEAN NOT NULL DEFAULT true,

  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("userId", "category"),
  CONSTRAINT "NotificationPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "NotificationPreference_category_idx"
  ON "NotificationPreference"("category");
