-- Unique listing views (one per identity per UTC day)
CREATE TABLE "PropertyView" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "viewerKey" TEXT NOT NULL,
    "viewDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropertyView_propertyId_viewerKey_viewDate_key"
    ON "PropertyView"("propertyId", "viewerKey", "viewDate");

ALTER TABLE "PropertyView"
    ADD CONSTRAINT "PropertyView_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
