# Owner Payments / Receipts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners see portfolio-linked pending cash, open payment detail, validate with metadata-backed rent allocation, and open the PDF receipt.

**Architecture:** Persist optional `rentScheduleId` on payment metadata at initiate. Expand `listManaged` with pending-cash union. Add `getOne` with payer-or-manager auth. Auto-build rent allocation from metadata when validate body is empty. Owner web mirrors leases/maintenance detail patterns.

**Tech Stack:** NestJS, Prisma `Payment`/`PaymentAllocation`/`RentSchedule`, Jest, Next.js owner dashboard, existing receipt API.

**Spec:** `docs/superpowers/specs/2026-07-13-owner-payments-receipts-design.md`

## Global Constraints

- Do **not** create allocations at initiate time.
- Validate empty body only works when `metadata.rentScheduleId` is set; otherwise `400 PAYMENT_ALLOCATION_REQUIRED`.
- Manage access for list/get/validate stays owner **or** org membership on property (same as today’s validate) — no full AgencyAccess rewrite required.
- Out of scope: agent validation UI rewrite, list property/tenant name columns, scoping `pending-validation`, mobile DTO typing beyond API field.
- French UI copy; English routes.
- Controller static paths (`payments/my`, `payments/pending-validation`, `payments/managed`) **above** `payments/:id`.

## File map

| Path | Responsibility |
|------|----------------|
| `apps/api/src/payments/payments.service.ts` | `rentScheduleId` metadata; validate auto-alloc; `listManaged` union; `getOne` |
| `apps/api/src/payments/payments.controller.ts` | DTO field; `GET payments/:id`; pass through |
| `apps/api/src/payments/payments.spec.ts` | New tests |
| `apps/api/openapi.json` | Export |
| `apps/web/lib/owner/payments.ts` | `getPayment`, `validatePayment`, `getPaymentReceipt` |
| `apps/web/lib/routes.ts` | `owner.payment(id)` |
| `apps/web/app/owner/payments/owner-payments.tsx` | Voir / Valider |
| `apps/web/app/owner/payments/[id]/page.tsx` | Thin page |
| `apps/web/app/owner/payments/[id]/owner-payment-detail.tsx` | Detail UI |

---

### Task 1: API — initiate with optional `rentScheduleId`

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts`
- Modify: `apps/api/src/payments/payments.controller.ts`
- Modify: `apps/api/src/payments/payments.spec.ts`

**Interfaces:**
- Extends: `InitiatePaymentInput` with `rentScheduleId?: string`
- Produces: metadata key `rentScheduleId` on created payment (no allocations)

- [ ] **Step 1: Add failing tests** in `payments.spec.ts` (after existing cash initiate test):

```typescript
  it('initiatePayment stores rentScheduleId in metadata without allocations', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-meta-sched`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    expect(payment.status).toBe('PENDING_VALIDATION');
    expect(payment.allocations).toHaveLength(0);

    const row = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    const meta = (row.metadata ?? {}) as { rentScheduleId?: string };
    expect(meta.rentScheduleId).toBe(rentScheduleId);
  });

  it('initiatePayment rejects unknown rentScheduleId', async () => {
    await expect(
      payments.initiatePayment({
        userId: tenantUserId,
        amount: '150000',
        currency: 'XAF',
        method: 'CASH',
        idempotencyKey: `cash-${Date.now()}-bad-sched`,
        rentScheduleId: '00000000-0000-0000-0000-000000000099',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
```

Import `NotFoundException` from `@nestjs/common` at top of spec if missing.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/api && bunx jest src/payments/payments.spec.ts -t "rentScheduleId" --runInBand
```

Expected: FAIL (unknown `rentScheduleId` on input / no metadata).

- [ ] **Step 3: Implement**

In `InitiatePaymentInput` add `rentScheduleId?: string`.

In `initiatePayment`, after idempotency early-return and **before** building `metadata`, if `input.rentScheduleId`:

```typescript
    if (input.rentScheduleId) {
      const schedule = await this.prisma.rentSchedule.findUnique({
        where: { id: input.rentScheduleId },
        select: { id: true },
      });
      if (!schedule) {
        throw new NotFoundException({
          code: 'RENT_SCHEDULE_NOT_FOUND',
          message: 'Rent schedule does not exist',
        });
      }
    }
```

Merge into metadata:

```typescript
    const metadata: PaymentMetadata = {
      ...(input.metadata ?? {}),
      ...(input.rentScheduleId
        ? { rentScheduleId: input.rentScheduleId }
        : {}),
      ...(debt > 0
        ? {
            messagingDebtXaf: debt,
            messagingChargeIds: open.map((c) => c.id),
            baseAmountXaf: base,
          }
        : {}),
    };
```

In controller `InitiatePaymentDto`:

```typescript
  @IsOptional() @IsString() rentScheduleId?: string;
```

Pass through: `initiatePayment({ ...dto, userId: current.userId })` (already spreads dto).

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd apps/api && bunx jest src/payments/payments.spec.ts -t "rentScheduleId" --runInBand
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/payments/payments.service.ts apps/api/src/payments/payments.controller.ts apps/api/src/payments/payments.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): persist rentScheduleId on payment initiate metadata

EOF
)"
```

---

### Task 2: API — validate auto-alloc from metadata

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts` (`validateCashPayment`)
- Modify: `apps/api/src/payments/payments.spec.ts`

**Interfaces:**
- Changes: empty `allocations` + `metadata.rentScheduleId` → builds `RENT_SCHEDULE` allocation; missing both → `BadRequestException` `PAYMENT_ALLOCATION_REQUIRED`
- RBAC still uses property resolved from the **effective** rent schedule (after auto-build)

- [ ] **Step 1: Add failing tests**

```typescript
  it('owner validates cash with empty allocations using metadata.rentScheduleId', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-owner-meta`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const validated = await payments.validateCashPayment(
      ownerUserId,
      payment.id,
      [],
    );
    expect(validated.status).toBe('VALIDATED');
    expect(validated.validatedBy).toBe(ownerUserId);
    expect(
      validated.allocations.some((a) => a.rentScheduleId === rentScheduleId),
    ).toBe(true);
  });

  it('validateCashPayment without allocations or metadata rejects with BadRequest', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-no-alloc`,
    });
    createdPaymentIds.push(payment.id);

    await expect(
      payments.validateCashPayment(ownerUserId, payment.id, []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
```

Import `BadRequestException` if missing.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/payments/payments.spec.ts -t "metadata.rentScheduleId|without allocations or metadata" --runInBand
```

- [ ] **Step 3: Implement** — rewrite the start of `validateCashPayment` after status checks:

```typescript
    const meta = (payment.metadata ?? {}) as PaymentMetadata;
    const messagingDebt = Number(meta.messagingDebtXaf ?? 0);
    const messagingChargeIds = Array.isArray(meta.messagingChargeIds)
      ? meta.messagingChargeIds
      : [];

    const finalAllocations: PaymentAllocationInput[] = [...allocations];
    const hasRentAlloc = finalAllocations.some(
      (a) => a.type === 'RENT_SCHEDULE' && a.rentScheduleId,
    );
    if (!hasRentAlloc) {
      const scheduleId =
        typeof meta.rentScheduleId === 'string' ? meta.rentScheduleId : null;
      if (!scheduleId) {
        throw new BadRequestException({
          code: 'PAYMENT_ALLOCATION_REQUIRED',
          message:
            'Rent schedule allocation is required (body or payment metadata)',
        });
      }
      const rentAmount = Number(payment.amount) - messagingDebt;
      finalAllocations.push({
        type: AllocatableType.RENT_SCHEDULE,
        refId: scheduleId,
        rentScheduleId: scheduleId,
        amount: rentAmount,
      });
    }

    if (
      messagingDebt > 0 &&
      !finalAllocations.some((a) => a.type === AllocatableType.MESSAGING_DEBT)
    ) {
      finalAllocations.push({
        type: AllocatableType.MESSAGING_DEBT,
        refId: payment.userId,
        amount: messagingDebt,
      });
    }

    const firstAlloc = finalAllocations.find(
      (a) => a.type === 'RENT_SCHEDULE' && a.rentScheduleId,
    );
    // ... existing property resolve + RBAC using firstAlloc.rentScheduleId ...
    // Remove the old "if (!property) → admin only" path for empty alloc:
    // if no property after resolve, still allow PLATFORM_ADMIN only;
    // if property found, owner/member as today.
```

**Important:** Move metadata / `finalAllocations` construction **before** RBAC. Delete the earlier duplicate `meta` / messaging / `finalAllocations` block that currently sits after RBAC.

Keep existing transaction + event emit using `finalAllocations`.

- [ ] **Step 4: Run — expect PASS** (also re-run full payments suite)

```bash
cd apps/api && bunx jest src/payments/payments.spec.ts --runInBand
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/payments/payments.service.ts apps/api/src/payments/payments.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): auto-allocate cash validate from rentSchedule metadata

EOF
)"
```

---

### Task 3: API — `listManaged` pending union + `getOne`

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts`
- Modify: `apps/api/src/payments/payments.controller.ts`
- Modify: `apps/api/src/payments/payments.spec.ts`

**Interfaces:**
- Produces: `getOne(userId: string, paymentId: string): Promise<PublicPayment>`
- Changes: `listManaged` returns allocated ∪ pending portfolio cash

- [ ] **Step 1: Add failing tests**

```typescript
  it('listManaged includes pending cash linked by metadata.rentScheduleId', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-pending-managed`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const managed = await payments.listManaged(ownerUserId);
    expect(managed.some((p) => p.id === payment.id)).toBe(true);
  });

  it('getOne returns payment for owner of linked property', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-getone-owner`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const got = await payments.getOne(ownerUserId, payment.id);
    expect(got.id).toBe(payment.id);
  });

  it('getOne returns payment for the payer', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-getone-payer`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const got = await payments.getOne(tenantUserId, payment.id);
    expect(got.id).toBe(payment.id);
  });

  it('getOne forbids a stranger', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-getone-stranger`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const stranger = await prisma.user.create({
      data: {
        phone: `+24209${String(Date.now()).slice(-7)}`,
        countryId,
        name: 'Pay Stranger',
      },
    });
    await expect(
      payments.getOne(stranger.id, payment.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await prisma.user.delete({ where: { id: stranger.id } }).catch(() => undefined);
  });
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/payments/payments.spec.ts -t "pending cash linked|getOne" --runInBand
```

- [ ] **Step 3: Implement helpers + `getOne` + expand `listManaged`**

Add private helpers (same file):

```typescript
  private async accessiblePropertyIds(userId: string): Promise<string[]> {
    const accessible = await this.prisma.property.findMany({
      where: {
        OR: [
          { ownerId: userId },
          { organization: { members: { some: { userId } } } },
        ],
      },
      select: { id: true },
      take: 500,
    });
    return accessible.map((p) => p.id);
  }

  private async assertCanReadPayment(
    userId: string,
    payment: Payment & { allocations: PaymentAllocation[] },
  ): Promise<void> {
    if (payment.userId === userId) return;

    const meta = (payment.metadata ?? {}) as PaymentMetadata;
    const scheduleIds = new Set<string>();
    for (const a of payment.allocations) {
      if (a.rentScheduleId) scheduleIds.add(a.rentScheduleId);
    }
    if (typeof meta.rentScheduleId === 'string') {
      scheduleIds.add(meta.rentScheduleId);
    }

    const propertyIds = await this.accessiblePropertyIds(userId);
    if (propertyIds.length === 0) {
      throw new ForbiddenException({
        code: 'PAYMENT_FORBIDDEN',
        message: 'You are not authorized to read this payment',
      });
    }

    if (scheduleIds.size > 0) {
      const hit = await this.prisma.rentSchedule.findFirst({
        where: {
          id: { in: [...scheduleIds] },
          lease: { propertyId: { in: propertyIds } },
        },
        select: { id: true },
      });
      if (hit) return;
    }

    const activeLease = await this.prisma.lease.findFirst({
      where: {
        tenantId: payment.userId,
        status: 'ACTIVE',
        propertyId: { in: propertyIds },
      },
      select: { id: true },
    });
    if (activeLease) return;

    throw new ForbiddenException({
      code: 'PAYMENT_FORBIDDEN',
      message: 'You are not authorized to read this payment',
    });
  }
```

```typescript
  async getOne(userId: string, paymentId: string): Promise<PublicPayment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment does not exist',
      });
    }
    await this.assertCanReadPayment(userId, payment);
    return this.toPublic(payment);
  }
```

Replace `listManaged` body to:

1. `propertyIds = await accessiblePropertyIds(userId)`; if empty return `[]`.
2. Load lease ids → schedule ids (as today).
3. Load allocated payment ids via allocations (as today).
4. Load ACTIVE lease `tenantId`s on those properties.
5. Load pending cash:

```typescript
    const pendingRows = await this.prisma.payment.findMany({
      where: {
        method: 'CASH',
        status: PaymentStatus.PENDING_VALIDATION,
      },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const scheduleIdSet = new Set(scheduleIds);
    const tenantIdSet = new Set(activeTenantIds);
    const pendingIds = pendingRows
      .filter((p) => {
        const meta = (p.metadata ?? {}) as PaymentMetadata;
        if (
          typeof meta.rentScheduleId === 'string' &&
          scheduleIdSet.has(meta.rentScheduleId)
        ) {
          return true;
        }
        return tenantIdSet.has(p.userId);
      })
      .map((p) => p.id);
```

6. Union `paymentIds = unique(allocatedIds ∪ pendingIds)`, fetch up to 200 ordered by `createdAt desc`, `toPublic`.

Refactor existing allocated-path to reuse `accessiblePropertyIds`.

**Controller** — place **after** `managed`, **before** webhook:

```typescript
  @Get('payments/:id')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a payment by id' })
  getOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.payments.getOne(current.userId, id);
  }
```

Note: `ReceiptController` already has `GET payments/:paymentId/receipt` — more specific path; no conflict.

- [ ] **Step 4: Run full suite — expect PASS**

```bash
cd apps/api && bunx jest src/payments/payments.spec.ts --runInBand
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/payments/payments.service.ts apps/api/src/payments/payments.controller.ts apps/api/src/payments/payments.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): list pending managed cash and get payment by id

EOF
)"
```

---

### Task 4: OpenAPI export

**Files:**
- Modify: `apps/api/openapi.json` (generated)

- [ ] **Step 1: Export**

```bash
cd apps/api && bun run export:openapi
```

- [ ] **Step 2: Verify** `openapi.json` contains `PaymentsController_getOne` (or path `GET /payments/{id}`) and initiate schema mentions `rentScheduleId`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/openapi.json
git commit -m "$(cat <<'EOF'
chore(api): export OpenAPI for payment get-by-id and rentScheduleId

EOF
)"
```

---

### Task 5: Web client helpers + route

**Files:**
- Modify: `apps/web/lib/owner/payments.ts`
- Modify: `apps/web/lib/routes.ts`

**Interfaces:**
- Produces:
  - `getPayment(id: string): Promise<PublicPayment>`
  - `validatePayment(id: string, allocations?: ...): Promise<PublicPayment>`
  - `getPaymentReceipt(paymentId: string): Promise<PublicPaymentReceipt>`
  - `ROUTES.owner.payment(id: string)`

- [ ] **Step 1: Extend `apps/web/lib/owner/payments.ts`**

```typescript
import { apiFetch } from '@/lib/api';

export interface PublicPaymentAllocation {
  id: string;
  type: string;
  refId: string;
  amount: string;
  rentScheduleId: string | null;
}

export interface PublicPayment {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  method: string;
  provider: string | null;
  status: string;
  reference: string;
  idempotencyKey: string;
  validatedBy: string | null;
  validatedAt: string | null;
  messagingDebtXaf?: number;
  allocations?: PublicPaymentAllocation[];
  createdAt: string;
}

export interface PublicPaymentReceipt {
  id: string;
  paymentId: string;
  number: string;
  url: string;
  createdAt: string;
}

export async function listManagedPayments(): Promise<PublicPayment[]> {
  return apiFetch<PublicPayment[]>('/payments/managed');
}

export async function getPayment(id: string): Promise<PublicPayment> {
  return apiFetch<PublicPayment>(`/payments/${id}`);
}

export async function validatePayment(
  id: string,
  allocations: Array<{
    type: 'RENT_SCHEDULE' | 'BOOKING' | 'VISIT_BOOKING';
    refId: string;
    amount: string | number;
    rentScheduleId?: string;
  }> = [],
): Promise<PublicPayment> {
  return apiFetch<PublicPayment>(`/payments/${id}/validate`, {
    method: 'POST',
    body: { allocations },
  });
}

export async function getPaymentReceipt(
  paymentId: string,
): Promise<PublicPaymentReceipt> {
  return apiFetch<PublicPaymentReceipt>(`/payments/${paymentId}/receipt`);
}

// keep existing paymentStatusLabel / paymentStatusTone unchanged
```

- [ ] **Step 2: Add route**

In `ROUTES.owner`:

```typescript
    payments: '/owner/payments',
    payment: (id: string) => `/owner/payments/${id}`,
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/owner/payments.ts apps/web/lib/routes.ts
git commit -m "$(cat <<'EOF'
feat(web): owner payment get validate receipt helpers

EOF
)"
```

---

### Task 6: Owner payments list — Voir / Valider

**Files:**
- Modify: `apps/web/app/owner/payments/owner-payments.tsx`

- [ ] **Step 1: Wire actions** (pattern from `owner-maintenance.tsx`)

Add imports: `Link` from `next/link`, `ROUTES`, `validatePayment`.

State: `validatingId: string | null`.

```typescript
  const handleValidate = useCallback(
    async (payment: PublicPayment) => {
      if (
        !confirm(
          `Valider le paiement de ${formatMoney(payment.amount, payment.currency)} ?`,
        )
      ) {
        return;
      }
      setValidatingId(payment.id);
      try {
        await validatePayment(payment.id);
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de valider le paiement.',
        );
      } finally {
        setValidatingId(null);
      }
    },
    [load],
  );
```

On `ListDataTable`:

```tsx
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            <Link
              href={ROUTES.owner.payment(row.id)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
            >
              Voir
            </Link>
            {row.method === 'CASH' && row.status === 'PENDING_VALIDATION' ? (
              <button
                type="button"
                disabled={validatingId === row.id}
                onClick={() => void handleValidate(row)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
              >
                {validatingId === row.id ? 'Validation…' : 'Valider'}
              </button>
            ) : null}
          </div>
        )}
```

- [ ] **Step 2: Manual check** — `cd apps/web && bun run lint` (or typecheck if used). Fix any type errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/owner/payments/owner-payments.tsx
git commit -m "$(cat <<'EOF'
feat(web): owner payments list Voir and Valider actions

EOF
)"
```

---

### Task 7: Owner payment detail page

**Files:**
- Create: `apps/web/app/owner/payments/[id]/page.tsx`
- Create: `apps/web/app/owner/payments/[id]/owner-payment-detail.tsx`

- [ ] **Step 1: Thin page**

```tsx
import { OwnerPaymentDetail } from './owner-payment-detail';

export default async function OwnerPaymentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OwnerPaymentDetail paymentId={id} />;
}
```

- [ ] **Step 2: Detail client component** (mirror `owner-lease-detail.tsx` structure)

```tsx
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  getPayment,
  getPaymentReceipt,
  paymentStatusLabel,
  paymentStatusTone,
  validatePayment,
  type PublicPayment,
} from '@/lib/owner/payments';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

export interface OwnerPaymentDetailProps {
  paymentId: string;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function OwnerPaymentDetail({
  paymentId,
}: OwnerPaymentDetailProps): React.JSX.Element {
  const { ready } = useRequireSession();
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPayment(paymentId);
      setPayment(data);
      setError(null);
    } catch (err) {
      setPayment(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le paiement.',
      );
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleValidate = useCallback(async () => {
    if (!payment) return;
    if (
      !confirm(
        `Valider le paiement de ${formatMoney(payment.amount, payment.currency)} ?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await validatePayment(payment.id);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de valider le paiement.',
      );
    } finally {
      setBusy(false);
    }
  }, [load, payment]);

  const handleReceipt = useCallback(async () => {
    setBusy(true);
    try {
      const receipt = await getPaymentReceipt(paymentId);
      window.open(receipt.url, '_blank', 'noopener,noreferrer');
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’ouvrir le reçu.',
      );
    } finally {
      setBusy(false);
    }
  }, [paymentId]);

  if (!ready || loading) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-muted">Chargement…</p>
      </section>
    );
  }

  if (!payment) {
    return (
      <section className="space-y-4">
        {error ? (
          <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}
        <Link href={ROUTES.owner.payments} className="text-sm text-accent">
          ← Retour aux paiements
        </Link>
      </section>
    );
  }

  const canValidate =
    payment.method === 'CASH' && payment.status === 'PENDING_VALIDATION';

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={payment.reference}
        breadcrumb={[
          { label: 'Paiements', href: ROUTES.owner.payments },
          { label: payment.id.slice(0, 8) },
        ]}
      />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          label={paymentStatusLabel(payment.status)}
          tone={paymentStatusTone(payment.status)}
        />
        {canValidate ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleValidate()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {busy ? 'Validation…' : 'Valider le paiement'}
          </button>
        ) : null}
        {payment.status === 'VALIDATED' ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleReceipt()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-card-hover disabled:opacity-50"
          >
            Ouvrir le reçu
          </button>
        ) : null}
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Montant</dt>
          <dd>{formatMoney(payment.amount, payment.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted">Méthode</dt>
          <dd>{payment.method === 'CASH' ? 'Espèces' : 'Mobile money'}</dd>
        </div>
        <div>
          <dt className="text-muted">Payeur</dt>
          <dd className="font-mono text-xs">{payment.userId}</dd>
        </div>
        <div>
          <dt className="text-muted">Créé le</dt>
          <dd>{formatDate(payment.createdAt)}</dd>
        </div>
        {payment.validatedAt ? (
          <div>
            <dt className="text-muted">Validé le</dt>
            <dd>{formatDate(payment.validatedAt)}</dd>
          </div>
        ) : null}
        {payment.validatedBy ? (
          <div>
            <dt className="text-muted">Validé par</dt>
            <dd className="font-mono text-xs">{payment.validatedBy}</dd>
          </div>
        ) : null}
      </dl>

      {(payment.allocations?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Allocations</h2>
          <ul className="space-y-1 text-sm">
            {payment.allocations!.map((a) => (
              <li key={a.id} className="font-mono text-xs">
                {a.type} · {a.amount} · {a.rentScheduleId ?? a.refId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
```

If `DashboardPageHeader` does not accept `breadcrumb`, match the exact prop API used in `owner-lease-detail.tsx` / `owner-maintenance-detail.tsx` instead of inventing — copy that pattern verbatim.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/owner/payments/[id]/page.tsx apps/web/app/owner/payments/[id]/owner-payment-detail.tsx
git commit -m "$(cat <<'EOF'
feat(web): owner payment detail with validate and receipt

EOF
)"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| `rentScheduleId` on initiate → metadata | 1 |
| `listManaged` pending union | 3 |
| `GET /payments/:id` | 3 |
| Validate auto-alloc + 400 | 2 |
| Owner list Voir / Valider | 6 |
| Detail + receipt | 7 |
| Client helpers | 5 |
| OpenAPI | 4 |
| Out of scope agent rewrite / name columns | not tasked |

No TBD placeholders. Types: `PublicPayment` / `getPayment` / `validatePayment` / `getPaymentReceipt` consistent across Tasks 5–7.
