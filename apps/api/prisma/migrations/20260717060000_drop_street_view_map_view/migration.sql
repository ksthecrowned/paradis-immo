-- Scrub legacy JSON values before enum shrink
UPDATE "Property"
SET "mapViews" = COALESCE(
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements_text(COALESCE("mapViews"::jsonb, '[]'::jsonb)) AS elem
    WHERE elem IN ('neighborhood', 'tour360')
  ),
  '[]'::jsonb
)
WHERE "mapViews" IS NOT NULL;

-- Rebuild enum without streetView
CREATE TYPE "MapViewId_new" AS ENUM ('neighborhood', 'tour360');
DROP TYPE "MapViewId";
ALTER TYPE "MapViewId_new" RENAME TO "MapViewId";
