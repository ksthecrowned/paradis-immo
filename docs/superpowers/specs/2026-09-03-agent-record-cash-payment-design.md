# Agent: enregistrer un paiement espèces

## Problem

Mobile no longer initiates cash payments (Mobile Money only). Agents can validate existing cash payments but cannot create them. The pending-validation queue stays empty without tenant initiation.

## Decision

**Approach A:** `POST /payments/record-cash` — create + validate in one transaction on behalf of the tenant.

## API

- `POST /payments/record-cash` (JWT)
- Body: `rentScheduleId`, `amount?` (default: schedule amount), `currency?`, `idempotencyKey`, `note?`
- Auth: `assertCanOperateOnProperty` (agent / owner / gérant / admin)
- Effects:
  - Payment `CASH`, `userId = lease.tenantId`, status `VALIDATED`, `validatedBy = agent`
  - Allocation to rent schedule; mark `PAID` / `PARTIAL` via existing helpers
  - Emit `PAYMENT_VALIDATED`
- Idempotent on `idempotencyKey`

## UI

Shared confirm dialog / action:

1. Lease schedule — CTA on `PENDING` / `OVERDUE` / `PARTIAL`
2. Tenant dossier — same on open dues
3. Agent payments page — “Enregistrer un paiement espèces” → pick lease/échéance **or** sale dossier/palier
4. Sale agreement detail — CTA on unpaid installments

Schedule/installment statuses shown in French (`À payer`, `Payé`, `En retard`, `Partiel`).

## Out of scope

Mobile cash initiate, changing existing validate flow.
