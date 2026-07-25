# Dossier locataire & cahier de loyer V1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship owner/agent **Locataires** (liste + fiche + validation paiement) and unify the mobile tenant surface as **Mon cahier de loyer**, without a new Prisma tenant table.

**Architecture:** Aggregate distinct `User` rows that appear as `Lease.tenantId` on operable properties (`AgencyAccessService.listOperablePropertyIds`). Reuse existing `Payment` / `validateCashPayment` / mobile rent hubs. No schema migration.

**Tech Stack:** NestJS 11 + Prisma 7, Next.js owner/agent dashboards, Expo Router mobile, Jest (`apps/api`).

**Spec:** `docs/superpowers/specs/2026-07-25-tenant-dossier-cahier-loyer-v1-design.md`

## Global Constraints

- No new Prisma model / migration for tenants.
- Scope = operable property IDs only (same as leases managed).
- Expose `User.createdAt` as `accountCreatedAt`.
- Validate button only when `payment.status === 'PENDING_VALIDATION'`.
- Call existing `POST /payments/:id/validate` (empty allocations OK when `metadata.rentScheduleId` present — same as owner payments page).
- Mobile: copy / hub only — no new payment domain.
- Hors scope: identity docs, lease PDFs, portable history, sale installments.

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/src/tenants/tenants.types.ts` | Public DTO types |
| `apps/api/src/tenants/tenants.service.ts` | Aggregation list + detail |
| `apps/api/src/tenants/tenants.controller.ts` | `GET managed`, `GET :userId` |
| `apps/api/src/tenants/tenants.module.ts` | Nest module |
| `apps/api/src/tenants/tenants.spec.ts` | Integration tests |
| `apps/api/src/app.module.ts` | Register `TenantsModule` |
| `apps/web/lib/owner/tenants.ts` | API client + types |
| `apps/web/lib/routes.ts` | Routes + nav Locataires |
| `apps/web/app/owner/tenants/page.tsx` | Route shell |
| `apps/web/app/owner/tenants/owner-tenants.tsx` | Liste |
| `apps/web/app/owner/tenants/[id]/page.tsx` | Route shell |
| `apps/web/app/owner/tenants/[id]/owner-tenant-detail.tsx` | Fiche + Valider |
| `apps/web/app/agent/tenants/*` | Miroir agent (même composants ou wrappers) |
| `apps/mobile/app/(tabs)/locations.tsx` | Entrée « Cahier de loyer » |
| `apps/mobile/app/portfolio/[propertyId]/rent.tsx` | Titres « Cahier de loyer » |
| `apps/mobile/app/cahier-loyer/index.tsx` | Hub multi-baux (si >1 ACTIVE) |
| `TODOS.md` | L0–L5 statuts |

---

### Task 1: API — types + `listManaged` (TDD)

**Files:**
- Create: `apps/api/src/tenants/tenants.types.ts`
- Create: `apps/api/src/tenants/tenants.service.ts`
- Create: `apps/api/src/tenants/tenants.spec.ts`
- Create: `apps/api/src/tenants/tenants.module.ts` (minimal, for DI in tests)

**Interfaces:**
- Produces: `TenantsService.listManaged(managerUserId: string): Promise<ManagedTenantListItem[]>`
- Consumes: `AgencyAccessService.listOperablePropertyIds`, `PrismaService`

- [ ] **Step 1: Add types**

```ts
// apps/api/src/tenants/tenants.types.ts
export type ManagedTenantLeaseSummary = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  status: string;
  monthlyRent: string;
  currency: string;
};

export type ManagedTenantPaymentSummary = {
  pendingValidation: number;
  overdueRentLines: number;
};

export type ManagedTenantListItem = {
  id: string;
  name: string | null;
  phone: string | null;
  accountCreatedAt: string;
  activeLeaseCount: number;
  leases: ManagedTenantLeaseSummary[];
  paymentSummary: ManagedTenantPaymentSummary;
};

export type TenantNextDue = {
  id: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: string;
};

export type ManagedTenantLeaseDetail = ManagedTenantLeaseSummary & {
  nextDue: TenantNextDue | null;
  overdueCount: number;
};

export type ManagedTenantRecentPayment = {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  method: string;
  provider: string | null;
  status: string;
  createdAt: string;
  validatedAt: string | null;
};

export type ManagedTenantDetail = Omit<ManagedTenantListItem, 'leases'> & {
  leases: ManagedTenantLeaseDetail[];
  recentPayments: ManagedTenantRecentPayment[];
};
```

- [ ] **Step 2: Write failing tests for listManaged**

Mirror setup style from `apps/api/src/leases/leases.spec.ts` (PrismaService + AgencyAccessService + seed country/quartier, create owner + tenant + property + lease).

```ts
// apps/api/src/tenants/tenants.spec.ts (excerpt)
describe('TenantsService.listManaged', () => {
  it('returns distinct tenants for operable properties with accountCreatedAt', async () => {
    const rows = await tenants.listManaged(ownerUserId);
    expect(rows.some((t) => t.id === tenantUserId)).toBe(true);
    const hit = rows.find((t) => t.id === tenantUserId)!;
    expect(hit.accountCreatedAt).toBe(tenantCreatedAtIso);
    expect(hit.leases.length).toBeGreaterThanOrEqual(1);
  });

  it('dedupes one tenant with two leases into a single row', async () => {
    // create second property + lease same tenant
    const rows = await tenants.listManaged(ownerUserId);
    expect(rows.filter((t) => t.id === tenantUserId)).toHaveLength(1);
    expect(
      rows.find((t) => t.id === tenantUserId)!.leases.length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for a user with no operable properties', async () => {
    expect(await tenants.listManaged(strangerUserId)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

```bash
cd apps/api && bunx jest src/tenants/tenants.spec.ts --runInBand
```

Expected: FAIL (module/service missing or methods unimplemented).

- [ ] **Step 4: Implement `listManaged`**

```ts
// apps/api/src/tenants/tenants.service.ts
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  async listManaged(managerUserId: string): Promise<ManagedTenantListItem[]> {
    const propertyIds =
      await this.agencyAccess.listOperablePropertyIds(managerUserId);
    if (propertyIds.length === 0) return [];

    const leases = await this.prisma.lease.findMany({
      where: { propertyId: { in: propertyIds } },
      include: {
        tenant: { select: { id: true, name: true, phone: true, createdAt: true } },
        property: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byTenant = new Map<string, ManagedTenantListItem>();
    for (const lease of leases) {
      const t = lease.tenant;
      let row = byTenant.get(t.id);
      if (!row) {
        row = {
          id: t.id,
          name: t.name,
          phone: t.phone,
          accountCreatedAt: t.createdAt.toISOString(),
          activeLeaseCount: 0,
          leases: [],
          paymentSummary: { pendingValidation: 0, overdueRentLines: 0 },
        };
        byTenant.set(t.id, row);
      }
      row.leases.push({
        id: lease.id,
        propertyId: lease.propertyId,
        propertyTitle: lease.property.title,
        status: lease.status,
        monthlyRent: lease.monthlyRent.toString(),
        currency: lease.currency,
      });
      if (lease.status === 'ACTIVE') row.activeLeaseCount += 1;
    }

    await this.attachPaymentSummaries([...byTenant.values()], propertyIds);

    return [...byTenant.values()].sort((a, b) => {
      const an = (a.name ?? '').toLocaleLowerCase();
      const bn = (b.name ?? '').toLocaleLowerCase();
      if (an && bn && an !== bn) return an.localeCompare(bn, 'fr');
      if (an && !bn) return -1;
      if (!an && bn) return 1;
      return b.accountCreatedAt.localeCompare(a.accountCreatedAt);
    });
  }

  // attachPaymentSummaries: for each tenant's leaseIds,
  // overdue = count RentSchedule where status PENDING and dueDate < now
  // pendingValidation = count Payment PENDING_VALIDATION linked via
  //   allocation.rentScheduleId in those schedules OR metadata.rentScheduleId
  //   OR (CASH pending + payer userId === tenantId) — align with PaymentsService.listManaged filters
}
```

Wire `TenantsModule`:

```ts
@Module({
  imports: [PrismaModule, MandatesModule],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/api && bunx jest src/tenants/tenants.spec.ts --runInBand
```

- [ ] **Step 6: Commit** (if user asked / branch policy allows)

```bash
git add apps/api/src/tenants
git commit -m "$(cat <<'EOF'
feat(api): aggregate managed tenants from leases

EOF
)"
```

---

### Task 2: API — `getManagedTenant` detail + payment summary assertions

**Files:**
- Modify: `apps/api/src/tenants/tenants.service.ts`
- Modify: `apps/api/src/tenants/tenants.spec.ts`

**Interfaces:**
- Produces: `getManagedTenant(managerUserId: string, tenantUserId: string): Promise<ManagedTenantDetail>`
- Throws: `NotFoundException({ code: 'TENANT_NOT_FOUND', message: '...' })`

- [ ] **Step 1: Failing tests**

```ts
it('getManagedTenant returns nextDue, overdueCount, recentPayments', async () => {
  const detail = await tenants.getManagedTenant(ownerUserId, tenantUserId);
  expect(detail.id).toBe(tenantUserId);
  expect(detail.leases[0]).toEqual(
    expect.objectContaining({ overdueCount: expect.any(Number) }),
  );
  expect(Array.isArray(detail.recentPayments)).toBe(true);
});

it('getManagedTenant 404 when no shared lease', async () => {
  await expect(
    tenants.getManagedTenant(ownerUserId, strangerUserId),
  ).rejects.toMatchObject({ response: { code: 'TENANT_NOT_FOUND' } });
});

it('paymentSummary counts overdue PENDING schedules', async () => {
  // seed RentSchedule PENDING with dueDate yesterday on ACTIVE lease
  const rows = await tenants.listManaged(ownerUserId);
  expect(
    rows.find((t) => t.id === tenantUserId)!.paymentSummary.overdueRentLines,
  ).toBeGreaterThanOrEqual(1);
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/tenants/tenants.spec.ts --runInBand
```

- [ ] **Step 3: Implement `getManagedTenant`**

Algorithm:

1. `propertyIds = listOperablePropertyIds`
2. Load leases for `tenantId` + `propertyId in propertyIds` (include property, tenant)
3. If none → `TENANT_NOT_FOUND`
4. For each lease: load schedules ordered by `dueDate asc`; compute `overdueCount`, `nextDue` = first `PENDING` (or null)
5. `recentPayments`: reuse same ID discovery as `PaymentsService.listManaged` but filtered to this tenant’s schedule IDs / userId; `take: 20`
6. Build `paymentSummary` on the detail header the same way as list

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/tenants
git commit -m "$(cat <<'EOF'
feat(api): tenant detail with schedule and recent payments

EOF
)"
```

---

### Task 3: API — controller + AppModule

**Files:**
- Create: `apps/api/src/tenants/tenants.controller.ts`
- Modify: `apps/api/src/tenants/tenants.module.ts` (add controller)
- Modify: `apps/api/src/app.module.ts` (import `TenantsModule`)

**Interfaces:**
- `GET /tenants/managed` → `listManaged`
- `GET /tenants/:userId` → `getManagedTenant`
- Auth: `AppAuthGuard` + `@CurrentUser()`

- [ ] **Step 1: Controller**

```ts
@ApiTags('Tenants')
@ApiBearerAuth()
@Controller('tenants')
@UseGuards(AppAuthGuard)
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Get('managed')
  @ApiOperation({ summary: 'List tenants on managed properties' })
  managed(@CurrentUser() current: AuthenticatedUser) {
    return this.tenants.listManaged(current.userId);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Tenant dossier for a managed tenant' })
  one(
    @CurrentUser() current: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.tenants.getManagedTenant(current.userId, userId);
  }
}
```

Declare `managed` **before** `:userId` (already ordered).

- [ ] **Step 2: Register module in `app.module.ts`** next to `LeasesModule`.

- [ ] **Step 3: Smoke** — start API or hit with existing e2e auth helper if present; otherwise rely on unit tests + manual curl with owner token.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/tenants apps/api/src/app.module.ts
git commit -m "$(cat <<'EOF'
feat(api): expose GET /tenants/managed and /tenants/:userId

EOF
)"
```

---

### Task 4: Web — client lib + routes + nav

**Files:**
- Create: `apps/web/lib/owner/tenants.ts`
- Modify: `apps/web/lib/routes.ts` (`ROUTES.owner.tenants`, `tenant`, agent equivalents, `OWNER_NAV` / `OWNER_NAV_GROUPS` / `AGENT_NAV` / breadcrumb map)

**Interfaces:**
- `listManagedTenants(): Promise<ManagedTenantListItem[]>`
- `getManagedTenant(id: string): Promise<ManagedTenantDetail>`
- Types mirror API types from Task 1

- [ ] **Step 1: Client**

```ts
// apps/web/lib/owner/tenants.ts
import { apiFetch } from '@/lib/api';
// export types matching ManagedTenantListItem / ManagedTenantDetail

export async function listManagedTenants() {
  return apiFetch<ManagedTenantListItem[]>('/tenants/managed');
}

export async function getManagedTenant(userId: string) {
  return apiFetch<ManagedTenantDetail>(`/tenants/${userId}`);
}
```

- [ ] **Step 2: Routes**

```ts
// in ROUTES.owner
tenants: '/owner/tenants',
tenant: (id: string) => `/owner/tenants/${id}`,

// in ROUTES.agent
tenants: '/agent/tenants',
tenant: (id: string) => `/agent/tenants/${id}`,
```

Add nav item **Locataires** in `OWNER_NAV_GROUPS` Activité (after Baux children block), and in `AGENT_NAV` after Baux. Add breadcrumb label `tenants: 'Locataires'` if a path→label map exists in the same file.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/owner/tenants.ts apps/web/lib/routes.ts
git commit -m "$(cat <<'EOF'
feat(web): tenants API client and Locataires nav routes

EOF
)"
```

---

### Task 5: Web owner — liste Locataires

**Files:**
- Create: `apps/web/app/owner/tenants/page.tsx`
- Create: `apps/web/app/owner/tenants/owner-tenants.tsx`

**Interfaces:**
- Consumes: `listManagedTenants`, `ROUTES.owner.tenant`
- UI: `DashboardPageHeader`, `ListDataTable`, `StatusBadge` (same patterns as `owner-leases.tsx` / `owner-payments.tsx`)

- [ ] **Step 1: Implement list page**

Columns: Nom, Téléphone, Compte créé le, Baux actifs, badges (si `pendingValidation > 0` → warning « À valider » ; si `overdueRentLines > 0` → danger « Retard »). Row link → `ROUTES.owner.tenant(id)`.

- [ ] **Step 2: Manual check** — open `/owner/tenants` logged as owner with at least one ACTIVE lease.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/owner/tenants
git commit -m "$(cat <<'EOF'
feat(web): owner tenants list page

EOF
)"
```

---

### Task 6: Web owner — fiche + Valider

**Files:**
- Create: `apps/web/app/owner/tenants/[id]/page.tsx`
- Create: `apps/web/app/owner/tenants/[id]/owner-tenant-detail.tsx`
- Reuse: `validatePayment` from `apps/web/lib/owner/payments.ts`
- Reuse labels: `paymentStatusLabel` / `paymentStatusTone`, `leaseStatusLabel`

**Interfaces:**
- Consumes: `getManagedTenant`, `validatePayment(id)` (default `allocations: []`)
- Links: `ROUTES.owner.lease(leaseId)`, `ROUTES.owner.payment(paymentId)` if useful

- [ ] **Step 1: Fiche layout**

Sections in order:

1. Header: name, phone, « Compte créé le … »
2. Baux: list with status + link
3. Échéances: per ACTIVE lease show `nextDue` + `overdueCount`
4. Paiements récents: table ; if `status === 'PENDING_VALIDATION'` show button **Valider** calling `validatePayment` then reload detail

- [ ] **Step 2: Manual** — create pending cash payment as tenant, validate from fiche.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/owner/tenants
git commit -m "$(cat <<'EOF'
feat(web): owner tenant dossier with payment validation

EOF
)"
```

---

### Task 7: Web agent — miroir Locataires

**Files:**
- Create: `apps/web/app/agent/tenants/page.tsx`
- Create: `apps/web/app/agent/tenants/[id]/page.tsx`
- Prefer re-exporting owner components with `ROUTES.agent.*` props, **or** thin wrappers that pass `leaseHref` / `tenantHref` base.

**Interfaces:**
- Same API client `lib/owner/tenants.ts` (shared)
- Nav already updated in Task 4

- [ ] **Step 1: Pages agent** pointing at same list/detail components parameterized by role routes.

- [ ] **Step 2: Smoke** `/agent/tenants` as agent user.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/agent/tenants
git commit -m "$(cat <<'EOF'
feat(web): agent tenants list and dossier

EOF
)"
```

---

### Task 8: Mobile — Mon cahier de loyer

**Files:**
- Modify: `apps/mobile/app/(tabs)/locations.tsx` (CTA / label toward cahier)
- Modify: `apps/mobile/app/portfolio/[propertyId]/rent.tsx` (screen title / hero copy → « Cahier de loyer »)
- Create: `apps/mobile/app/cahier-loyer/index.tsx` (optional hub)
- Modify: `apps/mobile/app/_layout.tsx` only if a new stack screen must be registered

**Interfaces:**
- Consumes: `listMyLeases` / `fetchActiveLeaseForProperty` / existing rent payment flow
- If `ACTIVE` leases length === 1 → `router.push(/portfolio/${propertyId}/rent)`
- If length > 1 → hub list → per-property rent
- If 0 → empty state « Aucun bail actif »

- [ ] **Step 1: Hub `cahier-loyer/index.tsx`**

```tsx
// load listMyLeases, filter status === 'ACTIVE'
// map to rows: property title (fetch catalog or lease payload), onPress → /portfolio/:id/rent
```

- [ ] **Step 2: Wire entry** from Locations tab (button or section « Cahier de loyer »).

- [ ] **Step 3: Rename visible titles on `rent.tsx` to « Cahier de loyer » (keep payment logic untouched).

- [ ] **Step 4: Manual on device/simulator with 0 / 1 / 2 active leases.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "$(cat <<'EOF'
feat(mobile): Mon cahier de loyer hub and copy

EOF
)"
```

---

### Task 9: Docs — mark V1 items done / spec approved

**Files:**
- Modify: `docs/superpowers/specs/2026-07-25-tenant-dossier-cahier-loyer-v1-design.md` (statut → **approuvé**)
- Modify: `TODOS.md` — L0 ✅ ; L1–L5 ✅ as delivered (or partial if something slipped)

- [ ] **Step 1: Update statuses to match reality after Tasks 1–8.**

- [ ] **Step 2: Commit**

```bash
git add TODOS.md docs/superpowers/specs/2026-07-25-tenant-dossier-cahier-loyer-v1-design.md
git commit -m "$(cat <<'EOF'
docs: approve tenant dossier V1 spec and update TODOS

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| `GET /tenants/managed` + dedupe + `accountCreatedAt` | 1 |
| `paymentSummary` overdue / pending | 1–2 |
| `GET /tenants/:userId` + nextDue + recentPayments + 404 | 2–3 |
| Reuse validate endpoint | 6 |
| Owner nav + liste + fiche | 4–6 |
| Agent mirror | 7 |
| Mobile cahier | 8 |
| No new Prisma tenant table | Global + all tasks |
| Hors scope docs/history/sale | Not scheduled |

## Placeholder scan

None intentional. `attachPaymentSummaries` is specified by behavior aligned with `PaymentsService.listManaged`; implementers should read that method and mirror filters rather than invent new linkage rules.
