-- Spec 03 — « REVOKED est conservé pour l'existant et migré vers TERMINATED
-- avec terminationReason = OWNER_REVOKED ».
-- Kept in its own migration: PostgreSQL cannot use an enum value in the same
-- transaction that added it (ALTER TYPE ... ADD VALUE lives in the previous
-- migration).
UPDATE "Mandate"
SET "status" = 'TERMINATED',
    "terminationReason" = 'OWNER_REVOKED',
    "terminationRequestedAt" = NOW(),
    "terminationEffectiveAt" = NOW()
WHERE "status" = 'REVOKED';
