# Agency Mandate Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist mandate → agent assignment, enforce gérant vs field-agent access, seed demo users, and expose minimal agent UI + owner agency-only mandate picker.

**Architecture:** Add nullable `Mandate.assignedAgentId`. Centralize “can this user manage this mandated property?” in a small helper used by managed list/action paths. Gérant (`OrgMemberRole.ADMIN` on the mandate’s agency) can act on all org mandates and assign; field `AGENT` only if `assignedAgentId === userId`. Agency org never authenticates.

**Tech Stack:** NestJS, Prisma, Jest, Next.js owner/agent dashboards.

**Spec:** `docs/superpowers/specs/2026-07-12-agency-roles-mandate-assignment-design.md`

## Global Constraints

- One business account = Owner **or** Agent (already enforced on web); do not reintroduce role switching.
- Agency (`OrganizationType.AGENCY`) is not an actor — all actions use agent `userId` + org context.
- Owner mandates an **organization**, never a person.
- Gérant = `OrgMemberRole.ADMIN` on that agency; field agent = `OrgMemberRole.AGENT`.
- Unassigned mandate (`assignedAgentId` null): only gérants of that agency may operate; field agents cannot.
- Out of scope for this plan: “create property for owner” flow (follow-up plan). Invite/remove agents UI deferred.

## File map

| Path | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | `Mandate.assignedAgentId` + relation to `User` |
| `apps/api/prisma/migrations/…` | SQL migration |
| `apps/api/src/mandates/agency-access.service.ts` | Membership + assignment checks |
| `apps/api/src/mandates/mandates.service.ts` | Assign / list agency mandates; extend `PublicMandate` |
| `apps/api/src/mandates/mandates.controller.ts` | `PATCH /mandates/:id/assign`, `GET /mandates/managed` |
| `apps/api/src/mandates/agency-access.spec.ts` | Access matrix tests |
| `apps/api/src/mandates/mandates.assign.spec.ts` | Assign API tests |
| `apps/api/prisma/seed.ts` | Gérant + field agent; one mandated property assigned |
| `apps/web/lib/agent/mandates.ts` | Client helpers |
| `apps/web/app/agent/portfolio/…` or new assign panel | Minimal assign UI |
| `apps/web/app/owner/mandate/owner-mandate.tsx` | Agency org picker (public agencies list) |

## Phase note

Wire the access helper into **properties managed / leases managed / visits managed** first (highest traffic). Payments/maintenance can call the same helper in a follow-up commit inside Task 4 if timeboxed — do not leave visits ungated while leases are gated.

---

### Task 1: Schema — `Mandate.assignedAgentId`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration via Prisma

**Interfaces:**
- Produces: `Mandate.assignedAgentId: string | null` FK → `User.id`

- [ ] **Step 1: Update Prisma model**

On `Mandate`, add:

```prisma
assignedAgentId String?
assignedAgent   User?   @relation("MandateAssignedAgent", fields: [assignedAgentId], references: [id])
```

On `User`, add the back-relation:

```prisma
assignedMandates Mandate[] @relation("MandateAssignedAgent")
```

(Keep existing `User` relations intact; only append.)

- [ ] **Step 2: Create migration**

Run:

```bash
cd apps/api && bunx prisma migrate dev --name mandate_assigned_agent
```

Expected: migration applied; client generated.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): add Mandate.assignedAgentId for agency assignment"
```

---

### Task 2: Agency access helper (TDD)

**Files:**
- Create: `apps/api/src/mandates/agency-access.service.ts`
- Create: `apps/api/src/mandates/agency-access.spec.ts`
- Modify: `apps/api/src/mandates/mandates.module.ts` (export provider)

**Interfaces:**
- Produces:
  - `assertCanOperateOnProperty(userId, propertyId): Promise<void>`
  - `canOperateOnProperty(userId, propertyId): Promise<boolean>`
  - `assertIsAgencyGerant(userId, organizationId): Promise<void>`
- Rules:
  - Property owner always allowed.
  - Else active mandate for property: if user is `ADMIN` member of `mandate.organizationId` → allow; if `AGENT` and `mandate.assignedAgentId === userId` → allow; else forbid.
  - No active mandate: only owner (or existing owner-org membership patterns already used elsewhere — do not broaden).

- [ ] **Step 1: Write failing tests**

Create `agency-access.spec.ts` with fixtures: owner, gérant (`ADMIN`), assigned agent, unassigned agent, agency org, property, active mandate.

Assert:

1. Owner → allow  
2. Gérant → allow even if `assignedAgentId` null or another agent  
3. Assigned field agent → allow  
4. Unassigned field agent → forbid  
5. Stranger → forbid  

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/api && bunx jest src/mandates/agency-access.spec.ts --runInBand
```

- [ ] **Step 3: Implement `AgencyAccessService`**

```typescript
// Sketch — fill Prisma lookups to match tests
async canOperateOnProperty(userId: string, propertyId: string): Promise<boolean> {
  const property = await this.prisma.property.findUnique({
    where: { id: propertyId },
    select: { ownerId: true },
  });
  if (!property) return false;
  if (property.ownerId === userId) return true;

  const mandate = await this.prisma.mandate.findFirst({
    where: { propertyId, status: 'ACTIVE' },
  });
  if (!mandate) return false;

  const member = await this.prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId: mandate.organizationId,
      },
    },
  });
  if (!member) return false;
  if (member.role === 'ADMIN') return true;
  if (member.role === 'AGENT' && mandate.assignedAgentId === userId) return true;
  return false;
}
```

Throw `ForbiddenException` with code `NOT_ASSIGNED_AGENT` / `NOT_AGENCY_MEMBER` from `assert*` wrappers.

- [ ] **Step 4: Tests PASS + commit**

```bash
git add apps/api/src/mandates
git commit -m "feat(api): agency access helper for mandate assignment"
```

---

### Task 3: Assign API + list managed mandates

**Files:**
- Modify: `apps/api/src/mandates/mandate-approval.service.ts` (`PublicMandate` + `assignedAgentId`)
- Modify: `apps/api/src/mandates/mandates.service.ts`
- Modify: `apps/api/src/mandates/mandates.controller.ts`
- Create: `apps/api/src/mandates/dto/assign-mandate.dto.ts`
- Create: `apps/api/src/mandates/mandates.assign.spec.ts`

**Interfaces:**
- `PATCH /api/v1/mandates/:id/assign` body `{ agentUserId: string | null }`  
  - Caller must be gérant of `mandate.organizationId`  
  - If `agentUserId` set, that user must be `AGENT` or `ADMIN` member of same org  
  - `null` clears assignment  
- `GET /api/v1/mandates/managed` — mandates for agencies where caller is member; gérant sees all; field agent only where `assignedAgentId === self`

- [ ] **Step 1: Failing assign tests** (gérant ok, field agent 403, wrong org agent 400/403)

- [ ] **Step 2: Implement DTO, service methods, controller routes; extend `toPublic`**

```typescript
export interface PublicMandate {
  id: string;
  propertyId: string;
  organizationId: string;
  assignedAgentId: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}
```

- [ ] **Step 3: Tests PASS + commit**

```bash
git commit -m "feat(api): mandate assign endpoint and managed list"
```

---

### Task 4: Gate existing managed operations

**Files (minimum set):**
- Modify: `apps/api/src/visit-slots/visit-slots.service.ts` (`assertCanManageProperty` / `listManagedBookings`)
- Modify: `apps/api/src/leases/leases.service.ts` (`listManaged`, `assertCanManageLease`)
- Modify: `apps/api/src/properties/properties.service.ts` if agents list managed portfolio via org membership alone
- Optionally same pattern: payments `listManaged`, maintenance managed

**Interfaces:**
- Consumes: `AgencyAccessService.canOperateOnProperty` / `assertCanOperateOnProperty`
- For list endpoints: filter property IDs to those the user can operate on (owner properties ∪ allowed mandated).

- [ ] **Step 1: Add/adjust one focused test** proving unassigned agent no longer sees/manages a mandated visit or lease.

- [ ] **Step 2: Refactor assert/list methods to use the helper** (avoid duplicating OR owner/org logic inconsistently).

- [ ] **Step 3: Run affected specs + commit**

```bash
git commit -m "fix(api): gate managed ops on mandate agent assignment"
```

---

### Task 5: Seed gérant + assignment

**Files:**
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Seed accounts**

- `manager@paradisimmo.cg` / `Manager123!` — member of Paradis Immo org as `ADMIN` (gérant)  
- Keep `agent@paradisimmo.cg` as field `AGENT`  
- On at least one demo property with an active mandate to Paradis Immo, set `assignedAgentId` to the field agent (or leave one unassigned for gérant-only QA)

Log credentials in seed console output.

- [ ] **Step 2: `bun run prisma:seed` + commit**

```bash
git commit -m "chore(seed): agency gérant and mandate assignment fixtures"
```

---

### Task 6: Web — agent assign UI (minimal)

**Files:**
- Create: `apps/web/lib/agent/mandates.ts`
- Modify: agent portfolio page (prefer existing `apps/web/app/agent/portfolio/`) to list managed mandates and assign agent

**Interfaces:**
- `listManagedMandates()`, `assignMandate(id, agentUserId: string | null)`
- UI: table property / status / assignee; gérant sees select of org agents; field agent read-only

- [ ] **Step 1: Client helpers + wire portfolio (or small `/agent/mandates` page + nav link)**

- [ ] **Step 2: Manual smoke** — login manager, assign/unassign; login field agent, confirm portfolio shrinks.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(web): agent UI to assign mandated properties"
```

---

### Task 7: Web — owner mandate picks agencies only

**Files:**
- Modify: `apps/web/app/owner/mandate/owner-mandate.tsx`
- Use public agencies list from `apps/web` org helpers / `GET` organizations agencies endpoint (see `organizations.controller.ts`)

- [ ] **Step 1: Replace `listMyOrganizations()` in the mandate form with marketplace/agency list** (exclude own `OWNER` org).

- [ ] **Step 2: Copy: label “Agence” not “Organisation membre”.**

- [ ] **Step 3: Smoke + commit**

```bash
git commit -m "fix(web): owner mandate targets agencies only"
```

---

### Task 8: OpenAPI export

- [ ] **Step 1:** `cd apps/api && bun run export:openapi`  
- [ ] **Step 2:** Commit if `openapi.json` changed.

---

## Follow-up (not this plan)

- Create property **for** an owner (gérant-only), with audit actor = agent userId.
- Invite/remove agents; multi-assignee work queue.
- Tighten payments/maintenance if not fully covered in Task 4.

## Spec coverage

| Spec item | Task |
|-----------|------|
| `assignedAgentId` | 1 |
| Gérant vs agent powers | 2–3 |
| Assign / reassign | 3, 6 |
| Gate unassigned agents | 2, 4 |
| Seed gérant + agent | 5 |
| Owner picks agency | 7 |
| Create for owner | Follow-up |
| Agency not an actor | Global (no agency login) |
