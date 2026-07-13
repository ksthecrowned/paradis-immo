# Owner Leases Detail + Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners create draft leases, open lease detail, activate (with rent schedule), and navigate from a polished managed list.

**Architecture:** Add `GET /leases/:id` and authorize schedule reads via manager-or-tenant check. Extend `apps/web/lib/owner/leases.ts` with create/get/activate/schedule helpers. Add `/owner/leases/add` and `/owner/leases/[id]` pages; polish the list with Voir + CTAs. Property picker uses `listMyProperties()`; tenant remains a user-id field.

**Tech Stack:** NestJS, Prisma, Jest, Next.js owner dashboard, existing `ListDataTable` / `DashboardPageHeader`.

**Spec:** `docs/superpowers/specs/2026-07-12-owner-leases-detail-create-design.md`

## Global Constraints

- Authorize lease read: `assertCanOperateOnProperty(userId, propertyId)` **or** `lease.tenantId === userId`.
- Do **not** build owner request-sign / terminate in this slice.
- Tenant input = user id (hint in UI); property = select from mine.
- French UI copy; English paths.
- Out of scope: agent/owner form unification, display-name enrichment (optional nice-to-have only).

## File map

| Path | Responsibility |
|------|----------------|
| `apps/api/src/leases/leases.service.ts` | `getOne`, `assertCanReadLease`, harden `getSchedule` |
| `apps/api/src/leases/leases.controller.ts` | `GET :id` (before `:id/schedule` order is fine; keep `managed`/`my` above `:id`) |
| `apps/api/src/leases/leases.spec.ts` | getOne + schedule auth tests |
| `apps/web/lib/owner/leases.ts` | Client helpers |
| `apps/web/lib/routes.ts` | `leasesAdd` route |
| `apps/web/app/owner/leases/owner-leases.tsx` | List polish |
| `apps/web/app/owner/leases/add/page.tsx` | Thin page |
| `apps/web/app/owner/leases/owner-lease-form.tsx` | Create form |
| `apps/web/app/owner/leases/[id]/page.tsx` | Thin page |
| `apps/web/app/owner/leases/[id]/owner-lease-detail.tsx` | Detail + activate + schedule |
| `apps/api/openapi.json` | Export |

**Route order note:** In the controller, keep `@Get('managed')` and `@Get('my')` **above** `@Get(':id')` so Nest does not treat `managed` as an id.

---

### Task 1: API — `getOne` + schedule auth (TDD)

**Files:**
- Modify: `apps/api/src/leases/leases.service.ts`
- Modify: `apps/api/src/leases/leases.controller.ts`
- Modify: `apps/api/src/leases/leases.spec.ts`

**Interfaces:**
- Produces: `getOne(userId, leaseId): Promise<PublicLease>`
- Produces: `getSchedule(userId, leaseId): Promise<PublicRentScheduleEntry[]>` (signature change — pass `userId`)
- Consumes: `AgencyAccessService.canOperateOnProperty` / `assertCanOperateOnProperty`

- [ ] **Step 1: Add failing tests** in the existing `LeasesService — schedule generation` describe (or a new describe sharing the same fixtures). After lease create/activate helpers exist in the suite:

```typescript
  it('getOne returns the lease for the property owner', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2027-01-01T00:00:00Z'),
      endDate: new Date('2027-06-30T00:00:00Z'),
      monthlyRent: '100000',
      currency: 'XAF',
      deposit: '200000',
    });
    createdLeaseIds.push(lease.id);
    const got = await leases.getOne(ownerUserId, lease.id);
    expect(got.id).toBe(lease.id);
    expect(got.propertyId).toBe(propertyId);
  });

  it('getOne allows the tenant', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2027-07-01T00:00:00Z'),
      endDate: new Date('2027-12-31T00:00:00Z'),
      monthlyRent: '110000',
      currency: 'XAF',
      deposit: '220000',
    });
    createdLeaseIds.push(lease.id);
    const got = await leases.getOne(tenantUserId, lease.id);
    expect(got.id).toBe(lease.id);
  });

  it('getOne forbids a stranger', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2028-01-01T00:00:00Z'),
      endDate: new Date('2028-03-31T00:00:00Z'),
      monthlyRent: '90000',
      currency: 'XAF',
      deposit: '180000',
    });
    createdLeaseIds.push(lease.id);
    const stranger = await prisma.user.create({
      data: {
        phone: `+24207${String(Date.now()).slice(-7)}`,
        countryId,
        name: 'Lease Stranger',
      },
    });
    await expect(leases.getOne(stranger.id, lease.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await prisma.user.delete({ where: { id: stranger.id } }).catch(() => undefined);
  });

  it('getSchedule forbids a stranger', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2028-04-01T00:00:00Z'),
      endDate: new Date('2028-06-30T00:00:00Z'),
      monthlyRent: '95000',
      currency: 'XAF',
      deposit: '190000',
    });
    createdLeaseIds.push(lease.id);
    await leases.activateLease(ownerUserId, lease.id);
    const stranger = await prisma.user.create({
      data: {
        phone: `+24207${String(Date.now()).slice(-6)}9`,
        countryId,
        name: 'Schedule Stranger',
      },
    });
    await expect(
      leases.getSchedule(stranger.id, lease.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await prisma.user.delete({ where: { id: stranger.id } }).catch(() => undefined);
  });
```

Import `ForbiddenException` from `@nestjs/common` in the spec file.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/leases/leases.spec.ts --runInBand
```

Expected: `getOne` / `getSchedule` arity errors or missing method.

- [ ] **Step 3: Implement service helpers**

```typescript
  async getOne(userId: string, leaseId: string): Promise<PublicLease> {
    const lease = await this.prisma.lease.findUnique({ where: { id: leaseId } });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    await this.assertCanReadLease(userId, lease);
    return this.toPublic(lease);
  }

  async getSchedule(
    userId: string,
    leaseId: string,
  ): Promise<PublicRentScheduleEntry[]> {
    const lease = await this.prisma.lease.findUnique({ where: { id: leaseId } });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    await this.assertCanReadLease(userId, lease);
    const rows = await this.prisma.rentSchedule.findMany({
      where: { leaseId },
      orderBy: { dueDate: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      leaseId: r.leaseId,
      dueDate: r.dueDate.toISOString(),
      amount: r.amount.toString(),
      currency: r.currency,
      status: r.status,
    }));
  }

  private async assertCanReadLease(
    userId: string,
    lease: Pick<Lease, 'propertyId' | 'tenantId'>,
  ): Promise<void> {
    if (lease.tenantId === userId) return;
    await this.agencyAccess.assertCanOperateOnProperty(
      userId,
      lease.propertyId,
    );
  }
```

Replace the old `getSchedule(leaseId)` body with the signature above (update all callers).

- [ ] **Step 4: Wire controller**

Add **above** `@Get(':id/schedule')` (and after `my`):

```typescript
  @Get(':id')
  @ApiOperation({ summary: 'Get a lease by id (manager or tenant)' })
  getOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leases.getOne(current.userId, id);
  }
```

Update schedule handler:

```typescript
  @Get(':id/schedule')
  @ApiOperation({ summary: 'Get the rent schedule for a lease' })
  schedule(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.leases.getSchedule(current.userId, id);
  }
```

- [ ] **Step 5: Fix any other `getSchedule` callers** (e2e / other specs) to pass `userId`.

```bash
cd apps/api && rg "getSchedule\(" -n
```

- [ ] **Step 6: Run tests — PASS**

```bash
cd apps/api && bunx jest src/leases/leases.spec.ts --runInBand
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/leases/leases.service.ts \
  apps/api/src/leases/leases.controller.ts \
  apps/api/src/leases/leases.spec.ts
git commit -m "feat(api): get lease by id and authorize schedule reads"
```

---

### Task 2: Web client helpers + routes

**Files:**
- Modify: `apps/web/lib/owner/leases.ts`
- Modify: `apps/web/lib/routes.ts`

**Interfaces:**
- Produces: `createLease`, `getLease`, `activateLease`, `getLeaseSchedule`, `PublicRentScheduleEntry`
- Produces: `ROUTES.owner.leasesAdd = '/owner/leases/add'`

- [ ] **Step 1: Extend `owner/leases.ts`**

```typescript
export interface PublicRentScheduleEntry {
  id: string;
  leaseId: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: string;
}

export interface CreateLeaseInput {
  propertyId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  currency: string;
}

export async function createLease(
  input: CreateLeaseInput,
): Promise<PublicLease> {
  return apiFetch<PublicLease>('/leases', { method: 'POST', body: input });
}

export async function getLease(id: string): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}`);
}

export async function activateLease(id: string): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}/activate`, { method: 'PATCH' });
}

export async function getLeaseSchedule(
  id: string,
): Promise<PublicRentScheduleEntry[]> {
  return apiFetch<PublicRentScheduleEntry[]>(`/leases/${id}/schedule`);
}
```

Keep existing `listManagedLeases` and label helpers.

- [ ] **Step 2: Add route**

In `ROUTES.owner`:

```typescript
    leasesAdd: '/owner/leases/add',
```

Optionally add breadcrumb label `add: 'Créer'` only if needed; detail uses custom breadcrumbs.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/owner/leases.ts apps/web/lib/routes.ts
git commit -m "feat(web): owner lease client helpers and add route"
```

---

### Task 3: List polish

**Files:**
- Modify: `apps/web/app/owner/leases/owner-leases.tsx`

- [ ] **Step 1: Add Link import, header CTA, Voir action, empty CTA**

Mirror properties list patterns:

- Header action → `ROUTES.owner.leasesAdd` « Créer un bail »
- `actions={(row) => <Link href={ROUTES.owner.lease(row.id)}>Voir</Link>}`
- `emptyMessage` with CTA to add (ReactNode — already supported)

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/owner/leases/owner-leases.tsx
git commit -m "feat(web): owner leases list CTA and detail links"
```

---

### Task 4: Create form page

**Files:**
- Create: `apps/web/app/owner/leases/add/page.tsx`
- Create: `apps/web/app/owner/leases/owner-lease-form.tsx`

- [ ] **Step 1: Thin page**

```tsx
import { OwnerLeaseForm } from '../owner-lease-form';

export default function OwnerLeaseAddPage() {
  return <OwnerLeaseForm />;
}
```

- [ ] **Step 2: Form component** (client)

Behavior:
- `useRequireSession`
- Load `listMyProperties()` into `<select>` for property
- Fields: tenantId (text + hint « ID utilisateur du locataire »), startDate, endDate, monthlyRent, deposit, currency default `XAF`
- Submit → `createLease` → `router.push(ROUTES.owner.lease(lease.id))`
- `DashboardPageHeader` title « Créer un bail », breadcrumb Mes biens / Baux / Créer
- Danger banner on error

Copy field layout from `apps/web/app/agent/leases/agent-leases.tsx` create form (inputs + styling), but replace raw property UUID with the select.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/owner/leases/add/page.tsx \
  apps/web/app/owner/leases/owner-lease-form.tsx
git commit -m "feat(web): owner create lease form with property picker"
```

---

### Task 5: Detail page (activate + schedule)

**Files:**
- Create: `apps/web/app/owner/leases/[id]/page.tsx`
- Create: `apps/web/app/owner/leases/[id]/owner-lease-detail.tsx`

- [ ] **Step 1: Thin page** — pass `params.id` to `OwnerLeaseDetail`.

- [ ] **Step 2: Detail component**

- Load `getLease(id)` on ready
- If status `ACTIVE` (or after activate), load `getLeaseSchedule(id)`
- Header: title `Bail` + short id, status badge, breadcrumb `Paradis Immo` → Baux → short id
- Actions: if `DRAFT`, button **Activer** → `activateLease` → reload lease + schedule; show `ApiError.message` if `LEASE_SIGN_APPROVAL_REQUIRED`
- Body: property link `ROUTES.owner.property(propertyId)`, tenant id, dates, rent, deposit
- Schedule table when rows.length > 0: dueDate (fr), amount, currency, status
- Loading / error banners like property detail

- [ ] **Step 3: Smoke** — create draft as owner, open detail, activate (on non-mandated property or after approval), see schedule.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/owner/leases/[id]
git commit -m "feat(web): owner lease detail with activate and schedule"
```

---

### Task 6: OpenAPI export

- [ ] **Step 1:** `cd apps/api && bun run export:openapi`
- [ ] **Step 2:** Confirm `/api/v1/leases/{id}` present
- [ ] **Step 3:** Commit if changed

```bash
git add apps/api/openapi.json
git commit -m "chore(api): export OpenAPI for lease get-by-id"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| `GET /leases/:id` + auth | 1 |
| Schedule auth | 1 |
| Client helpers | 2 |
| List Voir / CTA / empty | 3 |
| Create + property picker | 4 |
| Detail activate + schedule | 5 |
| OpenAPI | 6 |

## Self-review

- `getSchedule` signature change is intentional; grep callers in Task 1 Step 5.
- Controller: `managed` / `my` stay above `:id`.
- No request-sign UI.
