# Vérification de solvabilité locataire (V2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner/agent demande l’accès aux 3 derniers loyers `PAID` d’un locataire géré ; le locataire accepte/refuse ; snapshot figé visible 7 jours.

**Architecture:** Nouveau modèle `SolvencyCheck` + service dans `TenantsModule`. Droits = même garde-fou que la fiche locataire (`AgencyAccessService.listOperablePropertyIds`). Snapshot JSON figé à l’acceptation. Expiration lazy à la lecture `latest`. Notif via `EventPublisher` + processor léger.

**Tech Stack:** NestJS + Prisma, Next.js owner/agent, Expo mobile, Jest e2e DB réelle.

**Spec:** `docs/superpowers/specs/2026-07-25-tenant-solvency-check-design.md`

## Global Constraints

- Contenu snapshot : `dueDate`, `paidAt`, `amount`, `currency`, `daysLate` — **pas** de nom de bien.
- Max **3** échéances `RentSchedule.status = PAID` (tous baux du locataire), tri `dueDate` desc.
- Accès owner : **7 jours** après acceptation (`expiresAt`).
- Un seul `PENDING` par `(requesterOrgId, tenantUserId)`.
- `paidAt` : `Payment.validatedAt` du paiement `VALIDATED` alloué au schedule ; sinon fallback `RentSchedule.updatedAt`.
- `requesterOrgId` : `property.organizationId` du premier bail géré liant manager ↔ tenant.
- Copy FR : « Demander la solvabilité », « En attente… », « Expire le … ».

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Enum + model + relations User/Organization |
| `apps/api/prisma/migrations/20260725090000_solvency_checks/migration.sql` | Migration |
| `apps/api/src/events/event.types.ts` | `SOLVENCY_CHECK_REQUESTED` |
| `apps/api/src/tenants/solvency-checks.service.ts` | Create / respond / latest / snapshot |
| `apps/api/src/tenants/solvency-checks.controller.ts` | Routes owner + `/me` |
| `apps/api/src/tenants/dto/respond-solvency-check.dto.ts` | `{ accept: boolean }` |
| `apps/api/src/tenants/solvency-checks.spec.ts` | Tests e2e service/HTTP |
| `apps/api/src/tenants/tenants.module.ts` | Wire service + controller |
| `apps/api/src/notifications/processors/solvency-check.processor.ts` | Notif locataire |
| `apps/api/src/notifications/notifications.module.ts` | Register processor |
| `apps/web/lib/owner/solvency.ts` | Client API |
| `apps/web/components/tenants/tenant-detail-page.tsx` | Bloc Solvabilité |
| `apps/mobile/lib/solvency.ts` | Client API |
| `apps/mobile/app/cahier-loyer/solvency.tsx` | Liste + répondre |
| `apps/mobile/app/cahier-loyer/index.tsx` | Badge / lien |
| `TODOS.md` | H1–H3 ✅ |

---

### Task 1: Prisma + event type

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260725090000_solvency_checks/migration.sql`
- Modify: `apps/api/src/events/event.types.ts`

**Interfaces:**
- Produces: `SolvencyCheck`, `SolvencyCheckStatus`, `DOMAIN_EVENTS.SOLVENCY_CHECK_REQUESTED`

- [ ] **Step 1: Add enum + model** after other tenant-related models:

```prisma
enum SolvencyCheckStatus {
  PENDING
  GRANTED
  DENIED
  EXPIRED
}

model SolvencyCheck {
  id              String              @id @default(uuid())
  tenantUserId    String
  tenant          User                @relation("SolvencyCheckTenant", fields: [tenantUserId], references: [id])
  requesterUserId String
  requesterOrgId  String
  organization    Organization        @relation(fields: [requesterOrgId], references: [id])
  status          SolvencyCheckStatus @default(PENDING)
  snapshot        Json?
  respondedAt     DateTime?
  expiresAt       DateTime?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([tenantUserId, status])
  @@index([requesterOrgId, tenantUserId])
}
```

Add `solvencyChecks SolvencyCheck[] @relation("SolvencyCheckTenant")` on `User`, and `solvencyChecks SolvencyCheck[]` on `Organization`.

- [ ] **Step 2: Migration SQL** — create enum, table, indexes, FKs.

- [ ] **Step 3: Extend domain events**

```ts
SOLVENCY_CHECK_REQUESTED: 'solvency_check.requested',
```

Payload type: `{ checkId: string; tenantUserId: string; requesterOrgId: string; organizationName: string }`.

- [ ] **Step 4: Apply**

```bash
cd apps/api && bunx prisma migrate deploy && bunx prisma generate
```

- [ ] **Step 5: Commit** (si demandé)

```bash
git add apps/api/prisma apps/api/src/events/event.types.ts
git commit -m "$(cat <<'EOF'
feat(api): add SolvencyCheck model and domain event

EOF
)"
```

---

### Task 2: Service — create + respond + latest (TDD)

**Files:**
- Create: `apps/api/src/tenants/solvency-checks.service.ts`
- Create: `apps/api/src/tenants/solvency-checks.spec.ts`
- Modify: `apps/api/src/tenants/tenants.module.ts` (providers only for now)

**Interfaces:**
- Consumes: `AgencyAccessService`, `PrismaService`, `EventPublisher`
- Produces:
  - `create(managerUserId, tenantUserId): Promise<PublicSolvencyCheck>`
  - `respond(tenantUserId, checkId, accept: boolean): Promise<PublicSolvencyCheck>`
  - `latestForOrg(managerUserId, tenantUserId): Promise<PublicSolvencyCheck | null>`
  - `listForTenant(tenantUserId): Promise<PublicSolvencyCheck[]>`

`PublicSolvencyCheck` shape:

```ts
{
  id: string;
  tenantUserId: string;
  requesterOrgId: string;
  organizationName: string;
  status: SolvencyCheckStatus;
  snapshot: SolvencySnapshotItem[] | null; // null unless GRANTED and not expired
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

type SolvencySnapshotItem = {
  dueDate: string; // YYYY-MM-DD
  paidAt: string;
  amount: string;
  currency: string;
  daysLate: number;
};
```

- [ ] **Step 1: Write failing tests** in `solvency-checks.spec.ts` (pattern like `tenants.spec.ts` / `property-reports.spec.ts`):
  - create → PENDING + emit event
  - create with 0 PAID → 400 `NO_PAID_RENTS`
  - second PENDING same org/tenant → 409 `PENDING_EXISTS`
  - accept → snapshot length ≤ 3, `expiresAt` ~ +7d, `daysLate` correct
  - deny → snapshot null for owner latest
  - latest after past `expiresAt` → status EXPIRED, snapshot null
  - stranger manager → 404/403 as fiche locataire

Seed: owner org property + lease A with 3 PAID schedules (+ payments validated) for tenant; manager = owner.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/tenants/solvency-checks.spec.ts --forceExit
```

- [ ] **Step 3: Implement `SolvencyChecksService`**

Key helpers (inline in service):

```ts
async assertManagedTenant(managerUserId: string, tenantUserId: string) {
  // reuse same propertyIds + lease find as TenantsService.getManagedTenant
  // return { leases, organizationId: leases[0].property.organizationId }
}

async countPaidRents(tenantUserId: string): Promise<number> { ... }

async buildSnapshot(tenantUserId: string): Promise<SolvencySnapshotItem[]> {
  // findMany RentSchedule where status PAID, lease.tenantId = tenantUserId
  // orderBy dueDate desc, take 3
  // for each: paidAt from allocation→payment.validatedAt ?? schedule.updatedAt
  // daysLate = max(0, floor((paidAt - dueDate) / 86400000)) in UTC calendar days
}

serialize(check, { includeSnapshot: boolean }): PublicSolvencyCheck
```

`create`: assert managed → countPaid ≥ 1 → no PENDING for org+tenant → create → `events.emit(SOLVENCY_CHECK_REQUESTED, …)`.

`respond`: load check, must be PENDING and tenant match → if accept: snapshot + GRANTED + expiresAt = now+7d ; else DENIED.

`latestForOrg`: assert managed → findFirst orderBy createdAt desc for org+tenant → if GRANTED && expiresAt < now → update EXPIRED → serialize without snapshot unless GRANTED valid.

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/api && bunx jest src/tenants/solvency-checks.spec.ts --forceExit
```

- [ ] **Step 5: Commit** (si demandé)

---

### Task 3: HTTP controllers + notification processor

**Files:**
- Create: `apps/api/src/tenants/dto/respond-solvency-check.dto.ts`
- Create: `apps/api/src/tenants/solvency-checks.controller.ts`
- Create: `apps/api/src/notifications/processors/solvency-check.processor.ts`
- Modify: `apps/api/src/tenants/tenants.module.ts`
- Modify: `apps/api/src/notifications/notifications.module.ts`
- Modify: `apps/api/src/tenants/solvency-checks.spec.ts` (add HTTP cases if not already)

**Interfaces:**
- Routes:
  - `POST /tenants/:userId/solvency-checks` (AppAuthGuard)
  - `GET /tenants/:userId/solvency-checks/latest`
  - `GET /me/solvency-checks`
  - `POST /me/solvency-checks/:id/respond`

- [ ] **Step 1: DTO**

```ts
export class RespondSolvencyCheckDto {
  @IsBoolean()
  accept!: boolean;
}
```

- [ ] **Step 2: Controller** — two `@Controller` classes in one file is OK, or split `MeSolvencyChecksController` `@Controller('me/solvency-checks')` + methods on tenants path. Prefer:

```ts
@Controller('tenants/:userId/solvency-checks')
// POST '' + GET 'latest'

@Controller('me/solvency-checks')
// GET '' + POST ':id/respond'
```

- [ ] **Step 3: Processor**

```ts
@OnEvent(DOMAIN_EVENTS.SOLVENCY_CHECK_REQUESTED)
async handle(event: DomainEvent<...>) {
  await this.notifications.send({
    userId: event.payload.tenantUserId,
    type: 'SOLVENCY_CHECK_REQUESTED',
    payload: {
      checkId: event.payload.checkId,
      organizationName: event.payload.organizationName,
    },
  });
}
```

Import `EventModule` / ensure `EventPublisher` available in TenantsModule (same pattern as LeasesModule).

- [ ] **Step 4: Extend e2e HTTP tests** for the 4 routes ; run jest again.

- [ ] **Step 5: Commit** (si demandé)

---

### Task 4: Web owner — bloc Solvabilité

**Files:**
- Create: `apps/web/lib/owner/solvency.ts`
- Modify: `apps/web/components/tenants/tenant-detail-page.tsx`

**Interfaces:**
- `requestSolvencyCheck(tenantId)` → POST
- `getLatestSolvencyCheck(tenantId)` → GET latest | null

- [ ] **Step 1: Client lib** — types mirroring `PublicSolvencyCheck`.

- [ ] **Step 2: UI block** on `TenantDetailPage` (after identity / before payments):
  - Load latest on mount with detail.
  - Button « Demander la solvabilité » if status missing / DENIED / EXPIRED.
  - PENDING → texte d’attente.
  - GRANTED → table (échéance, montant, payé le, retard j) + « Expire le {date} ».
  - On create error `NO_PAID_RENTS` → message inline.
  - Agent page reuses same component — no extra work.

- [ ] **Step 3: Manual smoke** owner tenant dossier (or storybook N/A).

- [ ] **Step 4: Commit** (si demandé)

---

### Task 5: Mobile locataire

**Files:**
- Create: `apps/mobile/lib/solvency.ts`
- Create: `apps/mobile/app/cahier-loyer/solvency.tsx`
- Modify: `apps/mobile/app/cahier-loyer/index.tsx`
- Optionally: entry link from `portfolio/[propertyId]/rent.tsx` if hub redirects away

**Interfaces:**
- `listMySolvencyChecks()`
- `respondSolvencyCheck(id, accept)`

- [ ] **Step 1: Client lib**

- [ ] **Step 2: Screen** `cahier-loyer/solvency.tsx`
  - Liste checks (PENDING en tête) avec `organizationName`
  - Sur PENDING : boutons Accepter / Refuser
  - Après action : confirmation courte

- [ ] **Step 3: Hub** — si `listMySolvencyChecks` a un PENDING, badge + lien « Demande de solvabilité ». Si hub redirige quand 1 bail, aussi afficher le lien sur l’écran rent du portfolio.

- [ ] **Step 4: Commit** (si demandé)

---

### Task 6: TODOS + smoke final

**Files:**
- Modify: `TODOS.md`

- [ ] **Step 1:** Mark H1–H3 ✅ ; focus actif → « V2 livré (local) » ou suivant V3.

- [ ] **Step 2: Run full API suite for solvency**

```bash
cd apps/api && bunx jest src/tenants/solvency-checks.spec.ts --forceExit
```

Expected: all pass.

- [ ] **Step 3: Commit** (si demandé)

```bash
git commit -m "$(cat <<'EOF'
feat: tenant solvency check (owner request + tenant consent)

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Model + statuses | 1 |
| Create / PENDING / notif | 2–3 |
| NO_PAID_RENTS / PENDING_EXISTS | 2 |
| Snapshot 3 + daysLate + 7j | 2 |
| Deny / expire lazy | 2 |
| Owner + me routes | 3 |
| Web bloc | 4 |
| Mobile accept/refuse | 5 |
| TODOS rename already done | 6 marks H1–H3 |

## Hors plan (volontaire)

- Notif owner sur réponse
- Cron d’expiration
- Score / nom du bien
- Solvabilité acheteur V3
