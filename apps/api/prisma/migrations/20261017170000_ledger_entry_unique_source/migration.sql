-- Spec 03 (chantier 03, G-P0-1) — une écriture immuable par bien et par
-- événement source. La contrainte matérialise l'idempotence annoncée par
-- `LedgerProcessor` : (sourceType, sourceId, type, propertyId).
--
-- Des doublons ont pu être écrits par la fenêtre TOCTOU de l'ancien
-- `findFirst` puis `create` (double webhook / rejeu concurrent). On conserve
-- la ligne la plus ancienne de chaque groupe : une répétition de la même
-- écriture ne doit pas être additionnée.
DELETE FROM "LedgerEntry" AS a
USING "LedgerEntry" AS b
WHERE a."sourceType" = b."sourceType"
  AND a."sourceId" = b."sourceId"
  AND a."type" = b."type"
  AND a."propertyId" = b."propertyId"
  AND (
    a."createdAt" > b."createdAt"
    OR (a."createdAt" = b."createdAt" AND a."id" > b."id")
  );

CREATE UNIQUE INDEX "LedgerEntry_sourceType_sourceId_type_propertyId_key"
ON "LedgerEntry"("sourceType", "sourceId", "type", "propertyId");
