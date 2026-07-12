# Owner Dashboard KPIs (Slice 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve real owner-scoped KPI counts from `GET /api/v1/owner/stats` and wire `/owner/dashboard` to that endpoint plus managed payment/visit lists (no hardcoded KPIs).

**Architecture:** New Nest `OwnerModule` with `OwnerStatsService` running parallel Prisma `count()` queries scoped like managed portfolio routes (`ownerId` OR org membership). Web dashboard loads stats + `/payments/managed` + `/visits/managed` in parallel; demo charts stay but are labeled.

**Tech Stack:** NestJS, Prisma, Jest + supertest (API), Next.js App Router client page, existing Darkone dashboard components.

**Spec:** `docs/superpowers/specs/2026-07-12-owner-dashboard-kpis-design.md`

## Global Constraints

- Counters: `activeProperties` (`Property.status = ACTIVE`), `activeLeases` (`Lease.status = ACTIVE`), `pendingPayments` (`INITIATED` | `PENDING_VALIDATION` only — never `FAILED` / `DISPUTED` / `VALIDATED`), `pendingVisitRequests` (`VisitBooking.status = PENDING`).
- Portfolio scope for all four counts: property `ownerId = userId` OR `organization.members` includes `userId` (same OR as `listManaged` / `listManagedBookings`).
- Auth: `AppAuthGuard` only → missing/invalid JWT = `401`. Empty portfolio = `200` with all zeros (align with managed list posture; do not invent a separate OWNER role gate).
- Web must not call `/payments/my` on this page; must not fall back to `12` / `8`.
- Charts remain demo; add visible « Aperçu (données démo) » on the owner dashboard chart row only.
- No agent/admin dashboard work; no real revenue time-series.

## File map

| Path | Responsibility |
|------|----------------|
| `apps/api/src/owner/owner-stats.service.ts` | Parallel scoped `count()` → `OwnerStats` |
| `apps/api/src/owner/owner.controller.ts` | `GET /owner/stats` |
| `apps/api/src/owner/owner.module.ts` | Wire service + controller + Prisma |
| `apps/api/src/owner/owner.controller.spec.ts` | E2E-style Nest tests (empty / fixture / 401) |
| `apps/api/src/app.module.ts` | Import `OwnerModule` |
| `apps/web/lib/owner/stats.ts` | Typed `fetchOwnerStats()` helper |
| `apps/web/app/owner/dashboard/page.tsx` | Parallel fetch stats + managed lists |
| `apps/web/app/owner/dashboard/owner-dashboard.tsx` | Bind counts; demo chart caption; remove `?? 12` / `?? 8` |

---

### Task 1: Owner stats API (TDD)

**Files:**
- Create: `apps/api/src/owner/owner-stats.service.ts`
- Create: `apps/api/src/owner/owner.controller.ts`
- Create: `apps/api/src/owner/owner.module.ts`
- Create: `apps/api/src/owner/owner.controller.spec.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `OwnerStats` `{ activeProperties: number; activeLeases: number; pendingPayments: number; pendingVisitRequests: number }`
- Produces: `OwnerStatsService.getStats(userId: string): Promise<OwnerStats>`
- Produces: `GET /api/v1/owner/stats` → raw `OwnerStats` JSON (no `{ statusCode, data }` wrapper — match `payments/managed` style, not admin wrapper)

- [ ] **Step 1: Write the failing spec**

Create `apps/api/src/owner/owner.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerModule } from './owner.module';

describe('Owner stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerUserId: string;
  let strangerUserId: string;
  let countryId: string;
  let quartierId: string;
  let orgId: string;
  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OwnerModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Seed CG country required');
    countryId = cg.id;
    const city = await prisma.city.findFirst({ where: { countryId } });
    if (!city) throw new Error('Seed city required');
    const q = await prisma.quartier.findFirst({
      where: { arrondissement: { cityId: city.id } },
    });
    if (!q) throw new Error('Seed quartier required');
    quartierId = q.id;

    const owner = await prisma.user.create({
      data: {
        phone: `+24206${String(Date.now()).slice(-6)}1`,
        countryId,
        name: 'Owner Stats Owner',
      },
    });
    ownerUserId = owner.id;
    createdUserIds.push(owner.id);

    const stranger = await prisma.user.create({
      data: {
        phone: `+24206${String(Date.now()).slice(-6)}2`,
        countryId,
        name: 'Owner Stats Stranger',
      },
    });
    strangerUserId = stranger.id;
    createdUserIds.push(stranger.id);

    const org = await prisma.organization.create({
      data: {
        name: `Owner Stats Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.visitBooking
      .deleteMany({ where: { id: { in: createdBookingIds } } })
      .catch(() => undefined);
    await prisma.paymentAllocation
      .deleteMany({ where: { paymentId: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.payment
      .deleteMany({ where: { id: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.rentSchedule
      .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.lease
      .deleteMany({ where: { id: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.visitSlot
      .deleteMany({ where: { propertyId: { in: createdPropertyIds } } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: { in: createdPropertyIds } } })
      .catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({ where: { organizationId: orgId } })
      .catch(() => undefined);
    await prisma.organization
      .delete({ where: { id: orgId } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(() => undefined);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/owner/stats').expect(401);
  });

  it('returns zeros for authenticated user with empty portfolio', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/owner/stats')
      .set('x-test-user', strangerUserId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(res.body).toEqual({
      activeProperties: 0,
      activeLeases: 0,
      pendingPayments: 0,
      pendingVisitRequests: 0,
    });
  });

  it('counts active properties, leases, pending payments, pending visits', async () => {
    const prop = await prisma.property.create({
      data: {
        title: 'Owner Stats Prop',
        description: 'stats fixture',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'Test',
        countryId,
        ownerId: ownerUserId,
        organizationId: orgId,
        status: 'ACTIVE',
      },
    });
    createdPropertyIds.push(prop.id);

    await prisma.property.create({
      data: {
        title: 'Owner Stats Draft',
        description: 'ignored',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 1,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'Test',
        countryId,
        ownerId: ownerUserId,
        organizationId: orgId,
        status: 'DRAFT',
      },
    }).then((p) => createdPropertyIds.push(p.id));

    const lease = await prisma.lease.create({
      data: {
        propertyId: prop.id,
        tenantId: strangerUserId,
        status: 'ACTIVE',
        startDate: new Date(),
        rentAmount: 100000,
        currency: 'XAF',
        depositAmount: 0,
      },
    });
    createdLeaseIds.push(lease.id);

    const schedule = await prisma.rentSchedule.create({
      data: {
        leaseId: lease.id,
        dueDate: new Date(),
        amount: 100000,
        currency: 'XAF',
        status: 'PENDING',
      },
    });

    const pendingPay = await prisma.payment.create({
      data: {
        userId: strangerUserId,
        amount: 100000,
        currency: 'XAF',
        method: 'MOBILE_MONEY',
        status: 'PENDING_VALIDATION',
        reference: `own-stats-${Date.now()}`,
        idempotencyKey: `own-stats-${Date.now()}`,
      },
    });
    createdPaymentIds.push(pendingPay.id);
    await prisma.paymentAllocation.create({
      data: {
        paymentId: pendingPay.id,
        type: 'RENT_SCHEDULE',
        refId: schedule.id,
        rentScheduleId: schedule.id,
        amount: 100000,
      },
    });

    const failedPay = await prisma.payment.create({
      data: {
        userId: strangerUserId,
        amount: 50000,
        currency: 'XAF',
        method: 'MOBILE_MONEY',
        status: 'FAILED',
        reference: `own-stats-fail-${Date.now()}`,
        idempotencyKey: `own-stats-fail-${Date.now()}`,
      },
    });
    createdPaymentIds.push(failedPay.id);
    await prisma.paymentAllocation.create({
      data: {
        paymentId: failedPay.id,
        type: 'RENT_SCHEDULE',
        refId: schedule.id,
        rentScheduleId: schedule.id,
        amount: 50000,
      },
    });

    const slot = await prisma.visitSlot.create({
      data: {
        propertyId: prop.id,
        startAt: new Date(Date.now() + 86400000),
        endAt: new Date(Date.now() + 86400000 + 1800000),
        status: 'AVAILABLE',
        source: 'MANUAL',
      },
    });
    const booking = await prisma.visitBooking.create({
      data: {
        slotId: slot.id,
        propertyId: prop.id,
        userId: strangerUserId,
        status: 'PENDING',
      },
    });
    createdBookingIds.push(booking.id);

    const res = await request(app.getHttpServer())
      .get('/api/v1/owner/stats')
      .set('x-test-user', ownerUserId)
      .set('x-test-roles', 'TENANT')
      .expect(200);

    expect(res.body).toEqual({
      activeProperties: 1,
      activeLeases: 1,
      pendingPayments: 1,
      pendingVisitRequests: 1,
    });
  });
});
```

Adjust fixture fields if Prisma schema rejects a field (check `Lease` / `Payment` / `VisitSlot` required columns in `schema.prisma` and mirror patterns from `apps/api/src/admin/admin.controller.spec.ts` or `apps/api/src/payments/payments.spec.ts`).

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd apps/api && bunx jest src/owner/owner.controller.spec.ts --runInBand
```

Expected: FAIL (module/path not found or 404).

- [ ] **Step 3: Implement service, controller, module**

`apps/api/src/owner/owner-stats.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import {
  LeaseStatus,
  PaymentStatus,
  PropertyStatus,
  VisitBookingStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OwnerStats {
  activeProperties: number;
  activeLeases: number;
  pendingPayments: number;
  pendingVisitRequests: number;
}

@Injectable()
export class OwnerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string): Promise<OwnerStats> {
    const propertyScope = {
      OR: [
        { ownerId: userId },
        { organization: { members: { some: { userId } } } },
      ],
    };

    const [
      activeProperties,
      activeLeases,
      pendingPayments,
      pendingVisitRequests,
    ] = await Promise.all([
      this.prisma.property.count({
        where: { ...propertyScope, status: PropertyStatus.ACTIVE },
      }),
      this.prisma.lease.count({
        where: {
          status: LeaseStatus.ACTIVE,
          property: propertyScope,
        },
      }),
      this.prisma.payment.count({
        where: {
          status: {
            in: [
              PaymentStatus.INITIATED,
              PaymentStatus.PENDING_VALIDATION,
            ],
          },
          allocations: {
            some: {
              rentSchedule: { lease: { property: propertyScope } },
            },
          },
        },
      }),
      this.prisma.visitBooking.count({
        where: {
          status: VisitBookingStatus.PENDING,
          property: propertyScope,
        },
      }),
    ]);

    return {
      activeProperties,
      activeLeases,
      pendingPayments,
      pendingVisitRequests,
    };
  }
}
```

`apps/api/src/owner/owner.controller.ts`:

```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { OwnerStatsService } from './owner-stats.service';

@ApiTags('Owner')
@ApiBearerAuth()
@Controller('owner')
@UseGuards(AppAuthGuard)
export class OwnerController {
  constructor(private readonly stats: OwnerStatsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Owner portfolio KPI counters' })
  getStats(@CurrentUser() current: AuthenticatedUser) {
    return this.stats.getStats(current.userId);
  }
}
```

`apps/api/src/owner/owner.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnerController } from './owner.controller';
import { OwnerStatsService } from './owner-stats.service';

@Module({
  imports: [PrismaModule],
  controllers: [OwnerController],
  providers: [OwnerStatsService],
})
export class OwnerModule {}
```

In `apps/api/src/app.module.ts`, add `OwnerModule` to the `imports` array next to `AdminModule`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
cd apps/api && bunx jest src/owner/owner.controller.spec.ts --runInBand
```

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/owner apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): add GET /owner/stats portfolio KPI counters

EOF
)"
```

---

### Task 2: Web dashboard wiring

**Files:**
- Create: `apps/web/lib/owner/stats.ts`
- Modify: `apps/web/app/owner/dashboard/page.tsx`
- Modify: `apps/web/app/owner/dashboard/owner-dashboard.tsx`

**Interfaces:**
- Consumes: `GET /owner/stats` → `OwnerStats` from Task 1
- Consumes: `listManagedPayments()` from `apps/web/lib/owner/payments.ts`
- Consumes: visits via `apiFetch('/visits/managed')` or existing `lib/visits` helper if present
- Produces: `OwnerDashboardCounts` with required numbers (no `null` fallbacks)

- [ ] **Step 1: Add stats client helper**

Create `apps/web/lib/owner/stats.ts`:

```typescript
import { apiFetch } from '@/lib/api';

export interface OwnerStats {
  activeProperties: number;
  activeLeases: number;
  pendingPayments: number;
  pendingVisitRequests: number;
}

export function fetchOwnerStats(): Promise<OwnerStats> {
  return apiFetch<OwnerStats>('/owner/stats');
}
```

- [ ] **Step 2: Update `OwnerDashboardCounts` and remove hardcoded fallbacks**

In `apps/web/app/owner/dashboard/owner-dashboard.tsx`:

Replace the counts interface and StatCard values:

```typescript
export interface OwnerDashboardCounts {
  activeProperties: number;
  activeLeases: number;
  pendingPayments: number;
  pendingVisitRequests: number;
}
```

Update StatCards:

```tsx
<StatCard
  label="Biens actifs"
  value={counts.activeProperties}
  href={ROUTES.owner.properties}
  icon={DASH_STAT_ICONS.buildings}
  sparkline={SPARKLINES.properties}
/>
<StatCard
  label="Baux actifs"
  value={counts.activeLeases}
  href={ROUTES.owner.leases}
  icon={DASH_STAT_ICONS.document}
  sparkline={SPARKLINES.leases}
  sparklineColor={DASH_CHART_COLORS.green}
/>
<StatCard
  label="Paiements en attente"
  value={counts.pendingPayments}
  href={ROUTES.owner.payments}
  icon={DASH_STAT_ICONS.wallet}
  sparkline={SPARKLINES.payments}
  sparklineColor={DASH_CHART_COLORS.amber}
/>
<StatCard
  label="Demandes de visite"
  value={counts.pendingVisitRequests}
  href={ROUTES.owner.visits}
  icon={DASH_STAT_ICONS.calendar}
  sparkline={SPARKLINES.visits}
  sparklineColor={DASH_CHART_COLORS.violet}
/>
```

Above the charts grid, add a discreet caption:

```tsx
<div className="space-y-2">
  <p className="text-xs text-muted">Aperçu (données démo)</p>
  <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
    <div className="xl:col-span-5">
      <RevenueChart />
    </div>
    <div className="xl:col-span-4">
      <PropertyModeChart />
    </div>
    <div className="xl:col-span-3">
      <SessionsMapCard />
    </div>
  </div>
</div>
```

Keep decorative `SPARKLINES` as-is (not live history).

- [ ] **Step 3: Rewrite dashboard page data loading**

Replace the `useEffect` body in `apps/web/app/owner/dashboard/page.tsx` with:

```typescript
import { fetchOwnerStats } from '@/lib/owner/stats';
import { listManagedPayments } from '@/lib/owner/payments';
// keep PublicVisitBooking type; use apiFetch for visits if no helper:
// import { listManagedVisits } from '@/lib/visits' when that export exists

useEffect(() => {
  if (!ready) return;
  let cancelled = false;
  (async (): Promise<void> => {
    const [statsResult, paymentResult, visitResult] = await Promise.all([
      fetchOwnerStats()
        .then((s) => ({ ok: true as const, s }))
        .catch((err: unknown) => ({ ok: false as const, err })),
      listManagedPayments().catch(() => [] as PublicPayment[]),
      apiFetch<PublicVisitBooking[]>('/visits/managed').catch(
        () => [] as PublicVisitBooking[],
      ),
    ]);
    if (cancelled) return;

    if (!statsResult.ok) {
      setError(
        statsResult.err instanceof ApiError
          ? statsResult.err.message
          : 'Erreur de chargement des indicateurs',
      );
      setCounts({
        activeProperties: 0,
        activeLeases: 0,
        pendingPayments: 0,
        pendingVisitRequests: 0,
      });
    } else {
      setError(null);
      setCounts({
        activeProperties: statsResult.s.activeProperties,
        activeLeases: statsResult.s.activeLeases,
        pendingPayments: statsResult.s.pendingPayments,
        pendingVisitRequests: statsResult.s.pendingVisitRequests,
      });
    }

    const paymentRows = paymentResult;
    const visitRows = visitResult;
    setPayments(
      paymentRows.slice(0, 5).map((p) => ({
        id: p.id,
        date: formatDate(p.createdAt),
        amount: formatMoney(p.amount, p.currency),
        status: p.status,
        method: p.method,
      })),
    );
    setVisits(
      visitRows.slice(0, 5).map((v) => ({
        id: v.id,
        date: formatDate(v.createdAt),
        status: v.status,
        propertyId: v.propertyId,
      })),
    );
  })();
  return () => {
    cancelled = true;
  };
}, [ready]);
```

UI behavior from spec: if stats fail, show danger banner **and** still show tables. Change the early `if (error) return banner` to render banner **above** `OwnerDashboard` when `counts` is set:

```tsx
if (!counts) {
  return (/* existing skeleton */);
}
return (
  <>
    {error ? (
      <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        {error}
      </div>
    ) : null}
    <OwnerDashboard counts={counts} payments={payments} visits={visits} />
  </>
);
```

Remove any remaining `/payments/my` usage and client-side pending/FAILED counting for KPI cards.

- [ ] **Step 4: Manual smoke**

Run API (`bun run start:dev` in `apps/api`) and web (`bun run dev` in `apps/web`). Login as `owner@paradisimmo.cg` / `Owner123!`. Open `/owner/dashboard`.

Expected:
- KPI numbers match `GET /api/v1/owner/stats` (Bearer from session).
- No `12` / `8` when portfolio empty or small.
- Payments table empty or real managed rows (not unrelated payer history).
- Chart row shows « Aperçu (données démo) ».

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/owner/stats.ts apps/web/app/owner/dashboard/page.tsx apps/web/app/owner/dashboard/owner-dashboard.tsx
git commit -m "$(cat <<'EOF'
feat(web): wire owner dashboard to /owner/stats and managed lists

EOF
)"
```

---

### Task 3: OpenAPI refresh (optional but preferred)

**Files:**
- Regenerate: OpenAPI artifact if the repo keeps a checked-in spec (see `apps/api/scripts/export-openapi.ts` / README)

- [ ] **Step 1: Export**

Run:

```bash
cd apps/api && bun run export:openapi
```

If this writes a file under `docs/` or `apps/api/`, include it in the commit. If the script only prints or is unused in CI, skip commit and note Swagger at `/api/docs` already picks up `@ApiTags('Owner')`.

- [ ] **Step 2: Commit only if a file changed**

```bash
git add -A  # only the openapi output path
git commit -m "$(cat <<'EOF'
docs(api): include owner stats in OpenAPI export

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `GET /owner/stats` + four fields | Task 1 |
| Counter filter rules | Task 1 service |
| Portfolio scope (managed OR) | Task 1 |
| Parallel `count()` | Task 1 |
| Web parallel fetch stats + managed lists | Task 2 |
| No `/payments/my`, no `12`/`8` | Task 2 |
| Stats error banner + tables still shown | Task 2 |
| Demo chart label | Task 2 |
| API tests empty / fixtures / 401 | Task 1 |
| OpenAPI | Task 3 |
| Real charts / agent / other slices | Out of scope |

## Clarification vs early draft

Spec text mentioned `403` for non-owner. Managed list endpoints return empty lists instead. This plan uses **401 without JWT** and **200 + zeros** for users with no accessible properties, so agents/org members and empty owners behave consistently.
