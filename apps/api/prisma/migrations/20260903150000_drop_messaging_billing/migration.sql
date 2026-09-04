-- Remove messaging billing: MessageCharge ledger + MESSAGING_DEBT allocations.

DELETE FROM "PaymentAllocation" WHERE type = 'MESSAGING_DEBT';

DROP TABLE IF EXISTS "MessageCharge";

DROP TYPE IF EXISTS "MessageChannel";
DROP TYPE IF EXISTS "MessagePayerType";
DROP TYPE IF EXISTS "MessageChargeStatus";

CREATE TYPE "AllocatableType_new" AS ENUM (
  'RENT_SCHEDULE',
  'BOOKING',
  'VISIT_BOOKING',
  'SALE_INSTALLMENT'
);

ALTER TABLE "PaymentAllocation"
  ALTER COLUMN "type" TYPE "AllocatableType_new"
  USING ("type"::text::"AllocatableType_new");

DROP TYPE "AllocatableType";

ALTER TYPE "AllocatableType_new" RENAME TO "AllocatableType";
