# Vente par paliers (SaleAgreement) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner/agent opens a sale dossier (property + buyer) with free-form installments; buyer pays/tracks them; owner validates like rent.

**Architecture:** New `SaleAgreement` + `SaleInstallment` models. Extend existing `SalesModule` (inquiries stay). Payments gain `SALE_INSTALLMENT` allocatable type, mirroring `RENT_SCHEDULE`. Activate sets `listingStatus = UNDER_OFFER`.

**Tech Stack:** NestJS + Prisma, Next.js owner/agent, Expo mobile, Jest.

**Spec:** `docs/superpowers/specs/2026-07-25-sale-installments-design.md`

## Global Constraints

- Dossier = **bien + acheteur** ; création **manuelle ou** depuis `SaleInquiry`.
- Σ paliers = `agreedPrice` (sinon `INSTALLMENTS_SUM_MISMATCH`).
- Activate → `UNDER_OFFER` (jamais `SOLD` auto) ; plusieurs ACTIVE par bien OK.
- Édition paliers : **DRAFT only**.
- Paiements : même moteur que loyer (`initiate` + `validate`).
- Copy FR : « Dossiers vente », « Répartir le reste », « Activer », « Valider ».
- Commits : seulement si l’utilisateur le demande.

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Enums + models + `AllocatableType.SALE_INSTALLMENT` + relations |
| `apps/api/prisma/migrations/20260725100000_sale_agreements/migration.sql` | Migration |
| `apps/api/src/sales/sale-agreements.service.ts` | CRUD + activate/complete/cancel |
| `apps/api/src/sales/sale-agreements.controller.ts` | Owner routes + `/me` |
| `apps/api/src/sales/dto/create-sale-agreement.dto.ts` | DTOs |
| `apps/api/src/sales/sale-agreements.spec.ts` | Tests |
| `apps/api/src/sales/sales.module.ts` | Wire providers |
| `apps/api/src/payments/payments.service.ts` | Init/validate installment |
| `apps/api/src/payments/payments.controller.ts` | Allow `saleInstallmentId` / allocation type |
| `apps/web/lib/owner/sale-agreements.ts` | Client |
| `apps/web/app/owner/sales/*` | Liste / form / détail |
| `apps/web/app/agent/sales/*` | CTA inquiry + liens dossiers (agent) |
| `apps/web/lib/routes.ts` | Nav « Dossiers vente » |
| `apps/mobile/lib/sale-agreements.ts` | Client |
| `apps/mobile/app/achats/*` | Hub + détail + payer |
| `TODOS.md` | S1–S3 ✅ |

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260725100000_sale_agreements/migration.sql`

**Interfaces:**
- Produces: `SaleAgreement`, `SaleInstallment`, statuses ; `AllocatableType.SALE_INSTALLMENT`
- Relations: `Property.saleAgreements`, `User.saleAgreementsBought`, `Organization.saleAgreements`, optional `SaleInquiry.agreement`

- [ ] **Step 1: Add enums + models** (exact fields from spec). Add `SALE_INSTALLMENT` to `AllocatableType`. Optional `saleInstallmentId` on `PaymentAllocation` (nullable FK) **or** use `refId` only like BOOKING — **prefer `refId` + type** (no new FK column) to stay consistent with BOOKING/VISIT.

- [ ] **Step 2: Migration SQL** for enums, tables, indexes, FKs, alter AllocatableType enum.

- [ ] **Step 3: Apply**

```bash
cd apps/api && bunx prisma migrate deploy && bunx prisma generate
```

- [ ] **Step 4: Commit** (si demandé)

---

### Task 2: SaleAgreementsService (TDD) — create / patch / activate

**Files:**
- Create: `apps/api/src/sales/sale-agreements.service.ts`
- Create: `apps/api/src/sales/dto/create-sale-agreement.dto.ts`
- Create: `apps/api/src/sales/sale-agreements.spec.ts`
- Modify: `apps/api/src/sales/sales.module.ts` (UsersModule + MandatesModule imports)

**Interfaces:**
- Consumes: `PrismaService`, `AgencyAccessService`, `UsersService`
- Produces:
  - `create(managerUserId, dto): PublicSaleAgreement`
  - `listManaged(managerUserId)`
  - `getOne(managerUserId, id)`
  - `updateDraft(managerUserId, id, dto)`
  - `activate(managerUserId, id)`
  - `complete` / `cancel`
  - `listMine(buyerUserId)` / `getMine(buyerUserId, id)`

`PublicSaleAgreement` includes property title, buyer name/phone, installments with lazy `OVERDUE` if `dueDate < now && PENDING`.

- [ ] **Step 1: Failing tests**
  - create manuel (phone+name) → DRAFT, installments ordered
  - sum mismatch → 400 `INSTALLMENTS_SUM_MISMATCH`
  - property not SALE → 400
  - create with `saleInquiryId` → links buyer from inquiry
  - activate → ACTIVE + `UNDER_OFFER` + inquiry `CLOSED` if linked
  - two ACTIVE on same property → OK
  - PATCH after ACTIVE → 400
  - stranger → 404/403

- [ ] **Step 2: Run FAIL**

```bash
cd apps/api && bunx jest src/sales/sale-agreements.spec.ts --forceExit
```

- [ ] **Step 3: Implement service**
  - `assertCanOperate(propertyId)` via AgencyAccess
  - `organizationId` from property
  - buyer via `resolveOrCreateByPhone` unless `saleInquiryId` (use inquiry.userId)
  - assert sum with Decimal / integer XAF string compare
  - activate: transaction update agreement + property listingStatus (skip if already SOLD) + inquiry CLOSED

- [ ] **Step 4: Run PASS**

- [ ] **Step 5: Commit** (si demandé)

---

### Task 3: HTTP controllers

**Files:**
- Create: `apps/api/src/sales/sale-agreements.controller.ts`
- Modify: `apps/api/src/sales/sales.module.ts`
- Extend: `sale-agreements.spec.ts` with HTTP cases optional (service tests may suffice if controller is thin)

**Routes:**
- `POST/GET /sale-agreements`
- `GET/PATCH /sale-agreements/:id`
- `POST /sale-agreements/:id/activate|complete|cancel`
- `GET /me/sale-agreements` · `GET /me/sale-agreements/:id`

- [ ] **Step 1: DTOs** with class-validator (nested installments array).

- [ ] **Step 2: Controllers** + AppAuthGuard.

- [ ] **Step 3: Smoke** jest suite still green.

---

### Task 4: Payments — SALE_INSTALLMENT

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts`
- Modify: `apps/api/src/payments/payments.controller.ts` (DTO `saleInstallmentId?`, allocation type allowlist)
- Modify: `apps/api/src/payments/payments.spec.ts` (1–2 cases)
- Optionally: receipt labels for installment

**Interfaces:**
- `initiatePayment({ saleInstallmentId, ... })` — buyer must own agreement ; installment PENDING/OVERDUE/PARTIAL ; amount matches remaining
- `validatePayment` with allocation `{ type: 'SALE_INSTALLMENT', refId: installmentId }` → mark installment PAID (mirror `maybeMarkRentSchedulePaid`)

- [ ] **Step 1: Failing payment tests** for initiate + validate installment.

- [ ] **Step 2: Implement** parallel branches to RENT_SCHEDULE (keep messaging debt behavior for rent only unless already generic).

- [ ] **Step 3: PASS**

```bash
cd apps/api && bunx jest src/payments/payments.spec.ts src/sales/sale-agreements.spec.ts --forceExit
```

---

### Task 5: Web owner/agent — dossiers vente

**Files:**
- Create: `apps/web/lib/owner/sale-agreements.ts`
- Create: `apps/web/app/owner/sales/page.tsx` + list/form/detail components
- Modify: `apps/web/lib/routes.ts` — `owner.sales`, nav item ; agent link to same or `/agent/sales/agreements`
- Modify: `apps/web/app/agent/sales/agent-sales.tsx` — CTA « Ouvrir un dossier » → form with inquiryId query

**UI:**
- List cards/table: bien, acheteur, prix, statut
- Form: PhoneInput + name, agreedPrice, dynamic installment rows, « Répartir le reste »
- Detail: installments table + Valider (reuse `validatePayment` with SALE_INSTALLMENT allocation)
- Activate / Complete / Cancel buttons by status

- [ ] **Step 1: Client lib**
- [ ] **Step 2: Pages + nav**
- [ ] **Step 3: Inquiry CTA**
- [ ] **Step 4: Commit** (si demandé)

---

### Task 6: Mobile acheteur

**Files:**
- Create: `apps/mobile/lib/sale-agreements.ts`
- Create: `apps/mobile/app/achats/index.tsx` + `[id].tsx`
- Entry: from locations/portfolio or account hub (add one clear link)
- Pay: reuse `initiatePayment` with `saleInstallmentId` (extend mobile payments lib)

- [ ] **Step 1: Client + screens**
- [ ] **Step 2: Wire payment navigation** like rent flow
- [ ] **Step 3: Commit** (si demandé)

---

### Task 7: TODOS + final smoke

- [ ] Mark S1–S3 ✅ ; focus → « V3 livré (local) » or S4 later
- [ ] Run:

```bash
cd apps/api && bunx jest src/sales/sale-agreements.spec.ts src/payments/payments.spec.ts --forceExit
```

---

## Spec coverage

| Spec | Task |
|------|------|
| Models + AllocatableType | 1 |
| Create / sum / inquiry / activate UNDER_OFFER | 2–3 |
| Multi ACTIVE | 2 |
| Payments validate → PAID | 4 |
| Owner web + inquiry CTA | 5 |
| Buyer mobile | 6 |
| TODOS | 7 |

## Hors plan

- SOLD auto, templates bien, S4 solvabilité acheteur, rent-reminder for installments, avenants post-ACTIVE
