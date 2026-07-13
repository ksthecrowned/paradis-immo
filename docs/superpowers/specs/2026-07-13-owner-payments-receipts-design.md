# Owner payments / receipts (slice 5) — design

**Date:** 2026-07-13  
**Status:** Approved  
**Related:** owner polish programme; approach A (link at initiate + owner detail); slices 3–4; agent validation queue (`/agent/payments/validation`)

## Goal

Owners can see cash payments awaiting validation on their portfolio, open a payment detail page, validate cash with a proper rent-schedule allocation, and open the PDF receipt when validated.

## Problem (current gaps)

1. `GET /payments/managed` only returns payments that already have `PaymentAllocation` rows. Cash in `PENDING_VALIDATION` has no allocations yet → owners never see them.
2. `POST /payments/:id/validate` resolves manage-scope via allocation `rentScheduleId`. Empty allocations → only `PLATFORM_ADMIN` succeeds (agent UI has the same pitfall).
3. Mobile rent flows pass `rentScheduleId` into initiate, but the API DTO ignores it — no durable link until validate.
4. No owner detail route; receipt API exists but is unused on owner web.

## In scope

1. Optional `rentScheduleId` on `POST /payments` → persist in payment `metadata`.
2. Expand `GET /payments/managed` to include portfolio-linked pending cash (via metadata schedule **or** payer’s active lease on managed properties).
3. `GET /payments/:id` with authorize: payer **or** manage-scope on linked property.
4. Harden `validateCashPayment`: if body allocations omit rent schedule, build one from `metadata.rentScheduleId`; RBAC via schedule → property (owner / org member / platform admin). Prefer aligning with `AgencyAccessService` where practical without rewriting the whole payments module.
5. Owner web: list **Voir** / **Valider**; detail `/owner/payments/[id]`; receipt open for `VALIDATED`.
6. Client helpers: `getPayment`, `validatePayment`, `getPaymentReceipt`; OpenAPI export.

## Out of scope

- Enriching list columns with property title / tenant name (follow-up).
- Rewriting agent validation screen (may benefit from metadata auto-alloc incidentally).
- Scoping global `GET /payments/pending-validation` (still unscoped; not owner path).
- Mobile initiate DTO sync beyond API accepting the field (mobile already sends it where typed loosely).
- Non-cash validation flows; refunds; partial allocation UI.

## API

### `POST /payments` (initiate)

- Add optional `rentScheduleId?: string` on DTO / `InitiatePaymentInput`.
- If present: verify schedule exists; store on metadata as `rentScheduleId` (alongside existing messaging debt fields).
- Do **not** create allocations at initiate time.

### `GET /payments/managed`

Return the union (deduped by id, newest first, same take limits as today):

**A — Allocated (existing):** properties accessible to user → leases → schedules → allocations → payments.

**B — Pending cash linked to portfolio:**
- `method = CASH`, `status = PENDING_VALIDATION`, and either:
  - `metadata.rentScheduleId` points at a schedule on an accessible property’s lease, **or**
  - payer (`userId`) has an **ACTIVE** lease on an accessible property (fallback when metadata missing).

Accessible properties: same OR as today (`ownerId` or org membership). Optional later: tighten to `AgencyAccessService` mandate assignment — not required for this slice if listManaged stays ownership/membership-based consistently with validate’s current membership check.

### `GET /payments/:id`

- Auth: `AppAuthGuard`.
- 404 if missing.
- Allow if `payment.userId === currentUser` **or** caller can manage a property linked via:
  - existing allocation’s rent schedule, **or**
  - `metadata.rentScheduleId`, **or**
  - payer’s ACTIVE lease on a property the caller owns / is org member of.
- Response: existing `PublicPayment` (include `allocations`).

### `POST /payments/:id/validate`

- Body `allocations` may be empty `[]`.
- If no `RENT_SCHEDULE` allocation with `rentScheduleId` in body:
  - If `metadata.rentScheduleId` set → append allocation `{ type: RENT_SCHEDULE, refId, rentScheduleId, amount: payment.amount - messagingDebt }` (same messaging-debt rules as today).
  - Else → `400` with clear code (e.g. `PAYMENT_ALLOCATION_REQUIRED`) — do not fall through to admin-only empty validate for non-admins.
- RBAC: resolve property from the (effective) rent schedule; allow owner, org member, or platform admin (keep existing ownership/membership rules; improve message consistency).
- Idempotent if already `VALIDATED`.

### Existing (consumed)

- `GET /payments/:paymentId/receipt` → `{ id, paymentId, number, url, createdAt }`.
- Receipt generation on validate (existing processor) unchanged.

## Web — list (`/owner/payments`)

- Columns unchanged in spirit (date, ref, amount, method, status).
- Row actions: **Voir** → `/owner/payments/[id]`.
- If `method === CASH` && `status === PENDING_VALIDATION`: **Valider** (confirm → `validatePayment(id)` with empty body; rely on metadata auto-alloc).
- Reload list after validate.

## Web — detail (`/owner/payments/[id]`)

- Load `getPayment(id)`.
- Header: reference + status badge; breadcrumb Paiements → short id.
- Show: amount, currency, method, provider, payer userId, validatedBy/At, allocations summary, createdAt.
- Actions:
  - Cash + pending → **Valider le paiement**.
  - `VALIDATED` → **Ouvrir le reçu** (fetch receipt, `window.open(url)` or download).
- Loading / error banners consistent with leases/maintenance detail.

## Client (`lib/owner/payments.ts`)

- Extend `PublicPayment` with `allocations` + `messagingDebtXaf` if needed for display.
- `getPayment`, `validatePayment`, `getPaymentReceipt`.

## Success criteria

- Pending cash with `metadata.rentScheduleId` on an owned property appears in managed list.
- Owner can open detail, validate, status → `VALIDATED`, allocations created.
- Owner can open receipt URL after validation.
- Stranger cannot GET or validate another portfolio’s payment.
- Validate without schedule metadata and without body allocations fails with 400 (not silent admin-only path for owners).
- OpenAPI includes `GET /payments/{id}` and initiate `rentScheduleId`.

## Open questions

None for this slice — fallback “payer ACTIVE lease” for list visibility is intentional when metadata is missing; validate still requires schedule (metadata or body).
