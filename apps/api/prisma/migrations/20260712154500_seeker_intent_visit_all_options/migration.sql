-- Align SeekerIntent with RENT | BUY | VISIT | ALL_OPTIONS
-- (replaces legacy BOTH if present)

ALTER TYPE "SeekerIntent" RENAME TO "SeekerIntent_old";

CREATE TYPE "SeekerIntent" AS ENUM ('RENT', 'BUY', 'VISIT', 'ALL_OPTIONS');

ALTER TABLE "User"
  ALTER COLUMN "seekerIntent" TYPE "SeekerIntent"
  USING (
    CASE "seekerIntent"::text
      WHEN 'BOTH' THEN 'ALL_OPTIONS'::"SeekerIntent"
      WHEN 'RENT' THEN 'RENT'::"SeekerIntent"
      WHEN 'BUY' THEN 'BUY'::"SeekerIntent"
      WHEN 'VISIT' THEN 'VISIT'::"SeekerIntent"
      WHEN 'ALL_OPTIONS' THEN 'ALL_OPTIONS'::"SeekerIntent"
      ELSE NULL
    END
  );

DROP TYPE "SeekerIntent_old";
