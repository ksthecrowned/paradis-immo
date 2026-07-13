# Owner Maintenance Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authenticated get-by-id for maintenance tickets, harden mutate auth, and ship owner detail UI (status, cost, assign) plus list Voir links.

**Architecture:** Inject `AgencyAccessService` into `MaintenanceService`. `getOne` allows manager or reporter; `updateTicket` / `assignTicket` require manager. Owner detail page mirrors leases polish patterns.

**Tech Stack:** NestJS, Prisma `MaintenanceStatus`, Jest, Next.js owner dashboard.

**Spec:** `docs/superpowers/specs/2026-07-13-owner-maintenance-detail-design.md`

## Global Constraints

- Mutate = manage-scope only (`assertCanOperateOnProperty`).
- Read = manage-scope **or** reporter.
- Status enum: `OPEN|ASSIGNED|IN_PROGRESS|DONE|CLOSED` (not `RESOLVED`).
- Assignee = user UUID input; no directory UI.
- Create stays on list page.
- Out of scope: mandate approval UI, agent detail page, payments.

## File map

| Path | Responsibility |
|------|----------------|
| `apps/api/src/maintenance/maintenance.service.ts` | `getOne`, auth on update/assign |
| `apps/api/src/maintenance/maintenance.controller.ts` | `GET :id`, pass `userId` to mutate |
| `apps/api/src/maintenance/maintenance.spec.ts` | Auth + getOne tests |
| `apps/web/lib/owner/maintenance.ts` | `getMaintenanceTicket`, fix DONE label |
| `apps/web/app/owner/maintenance/owner-maintenance.tsx` | Voir link |
| `apps/web/app/owner/maintenance/[id]/page.tsx` | Thin page |
| `apps/web/app/owner/maintenance/[id]/owner-maintenance-detail.tsx` | Detail UI |
| `apps/api/openapi.json` | Export |

**Controller order:** Keep `tickets/my`, `tickets/managed`, `tickets` **above** `tickets/:id`.

---

### Task 1: API — getOne + mutate auth (TDD)

**Files:**
- Modify: `apps/api/src/maintenance/maintenance.service.ts`
- Modify: `apps/api/src/maintenance/maintenance.controller.ts`
- Modify: `apps/api/src/maintenance/maintenance.spec.ts`

**Interfaces:**
- Produces: `getOne(userId, ticketId): Promise<PublicMaintenanceTicket>`
- Changes: `updateTicket(userId, ticketId, input)`, `assignTicket(userId, ticketId, assigneeId)`

- [ ] **Step 1: Inject AgencyAccessService** in constructor (module already imports `MandatesModule`).

```typescript
import { ForbiddenException, … } from '@nestjs/common';
import { AgencyAccessService } from '../mandates/agency-access.service';

constructor(
  private readonly prisma: PrismaService,
  private readonly events: EventPublisher,
  private readonly approvals: MandateApprovalService,
  private readonly agencyAccess: AgencyAccessService,
) {}
```

- [ ] **Step 2: Failing tests** (extend existing suite fixtures — owner, agent, property, tickets). Add:

```typescript
  it('getOne returns ticket for property owner', async () => {
    const t = await maintenance.createTicket({
      propertyId,
      reporterId: tenantUserId,
      title: 'Fuite',
      description: 'Cuisine',
    });
    const got = await maintenance.getOne(ownerUserId, t.id);
    expect(got.id).toBe(t.id);
  });

  it('getOne allows the reporter', async () => {
    const t = await maintenance.createTicket({
      propertyId,
      reporterId: tenantUserId,
      title: 'Prise',
      description: 'Salon',
    });
    const got = await maintenance.getOne(tenantUserId, t.id);
    expect(got.id).toBe(t.id);
  });

  it('getOne forbids a stranger', async () => {
    const t = await maintenance.createTicket({
      propertyId,
      reporterId: tenantUserId,
      title: 'X',
      description: 'Y',
    });
    const stranger = await prisma.user.create({
      data: {
        phone: `+24209${String(Date.now()).slice(-7)}`,
        countryId,
        name: 'Maint Stranger',
      },
    });
    await expect(maintenance.getOne(stranger.id, t.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await prisma.user.delete({ where: { id: stranger.id } }).catch(() => undefined);
  });

  it('updateTicket forbids reporter who is not manager', async () => {
    const t = await maintenance.createTicket({
      propertyId,
      reporterId: tenantUserId,
      title: 'Z',
      description: 'Z',
    });
    await expect(
      maintenance.updateTicket(tenantUserId, t.id, {
        status: MaintenanceStatus.IN_PROGRESS,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('updateTicket allows owner to set status and cost', async () => {
    const t = await maintenance.createTicket({
      propertyId,
      reporterId: tenantUserId,
      title: 'Peinture',
      description: 'Mur',
    });
    const updated = await maintenance.updateTicket(ownerUserId, t.id, {
      status: MaintenanceStatus.IN_PROGRESS,
      estimatedCost: 75000,
    });
    expect(updated.status).toBe(MaintenanceStatus.IN_PROGRESS);
    expect(updated.estimatedCost).toBe('75000');
  });
```

Adapt fixture variable names to match the existing spec (`ownerUserId`, `tenantUserId`, `propertyId`, `countryId`, `maintenance` service). Provide `AgencyAccessService` in the test module if missing. Import `ForbiddenException`, `MaintenanceStatus`.

Update any existing calls to `updateTicket(id, …)` / `assignTicket(id, …)` in the spec to pass `ownerUserId` as first arg.

- [ ] **Step 3: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/maintenance/maintenance.spec.ts --runInBand
```

- [ ] **Step 4: Implement**

```typescript
  async getOne(
    userId: string,
    ticketId: string,
  ): Promise<PublicMaintenanceTicket> {
    const ticket = await this.prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket does not exist',
      });
    }
    await this.assertCanReadTicket(userId, ticket);
    return this.toPublic(ticket);
  }

  async updateTicket(
    userId: string,
    ticketId: string,
    input: UpdateMaintenanceTicketInput,
  ): Promise<PublicMaintenanceTicket> {
    const existing = await this.prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket does not exist',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      userId,
      existing.propertyId,
    );
    // … existing update logic
  }

  async assignTicket(
    userId: string,
    ticketId: string,
    assigneeId: string,
  ): Promise<PublicMaintenanceTicket> {
    const existing = await this.prisma.maintenanceTicket.findUnique({
      where: { id: ticketId },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'TICKET_NOT_FOUND',
        message: 'Ticket does not exist',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      userId,
      existing.propertyId,
    );
    // … existing assign logic
  }

  private async assertCanReadTicket(
    userId: string,
    ticket: Pick<MaintenanceTicket, 'propertyId' | 'reporterId'>,
  ): Promise<void> {
    if (ticket.reporterId === userId) return;
    await this.agencyAccess.assertCanOperateOnProperty(
      userId,
      ticket.propertyId,
    );
  }
```

- [ ] **Step 5: Controller**

```typescript
  @Get('maintenance/tickets/:id')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Get a maintenance ticket by id' })
  getOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.maintenance.getOne(current.userId, id);
  }

  @Patch('maintenance/tickets/:id')
  @UseGuards(AppAuthGuard)
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.maintenance.updateTicket(current.userId, id, {
      status: dto.status,
      estimatedCost: dto.estimatedCost,
    });
  }

  @Patch('maintenance/tickets/:id/assign')
  @UseGuards(AppAuthGuard)
  assign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.maintenance.assignTicket(current.userId, id, dto.assigneeId);
  }
```

Place `GET :id` **after** `managed` / `my` / list routes.

- [ ] **Step 6: Tests PASS + commit**

```bash
cd apps/api && bunx jest src/maintenance/maintenance.spec.ts --runInBand
git add apps/api/src/maintenance
git commit -m "feat(api): get maintenance ticket by id and harden mutate auth"
```

---

### Task 2: Web client helpers

**Files:**
- Modify: `apps/web/lib/owner/maintenance.ts`

- [ ] **Step 1: Add get + fix labels**

```typescript
export async function getMaintenanceTicket(
  id: string,
): Promise<PublicMaintenanceTicket> {
  return apiFetch<PublicMaintenanceTicket>(`/maintenance/tickets/${id}`);
}
```

In `maintenanceStatusLabel`, replace `RESOLVED: 'Résolu'` with `DONE: 'Terminé'`.  
In `maintenanceStatusTone`, use `DONE` instead of `RESOLVED`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/owner/maintenance.ts
git commit -m "feat(web): getMaintenanceTicket helper and DONE status label"
```

---

### Task 3: List Voir link

**Files:**
- Modify: `apps/web/app/owner/maintenance/owner-maintenance.tsx`

- [ ] **Step 1:** Import `Link`, `ROUTES`. Add `actions` on `ListDataTable`:

```tsx
actions={(row) => (
  <Link
    href={ROUTES.owner.maintenanceTicket(row.id)}
    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
  >
    Voir
  </Link>
)}
```

If filter options include `RESOLVED`, change to `DONE`.

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/owner/maintenance/owner-maintenance.tsx
git commit -m "feat(web): link owner maintenance list rows to detail"
```

---

### Task 4: Detail page

**Files:**
- Create: `apps/web/app/owner/maintenance/[id]/page.tsx`
- Create: `apps/web/app/owner/maintenance/[id]/owner-maintenance-detail.tsx`

- [ ] **Step 1: Thin page** — pass `params.id` like leases detail.

- [ ] **Step 2: Detail component** (client)

- Load `getMaintenanceTicket(id)`
- Header: ticket title, status badge, breadcrumb Paradis Immo → Maintenance → short id
- Body: property link (`ROUTES.owner.property`), reporter id, description, priority label, approval banner if `requiresOwnerApproval`
- Form controls:
  - status select (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `DONE`, `CLOSED`) → save via `updateMaintenanceTicket`
  - estimated cost number (empty = leave unchanged; submit sets number) → update
  - assigneeId text + Assigner button → `assignMaintenanceTicket` (confirm optional)
- Busy/error banners; after success reload ticket

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/owner/maintenance/[id]
git commit -m "feat(web): owner maintenance detail with status cost and assign"
```

---

### Task 5: OpenAPI

```bash
cd apps/api && bun run export:openapi
git add apps/api/openapi.json
git commit -m "chore(api): export OpenAPI for maintenance get-by-id"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| GET by id + read auth | 1 |
| Mutate manage-scope | 1 |
| Client helper + DONE label | 2 |
| List Voir | 3 |
| Detail status/cost/assign | 4 |
| OpenAPI | 5 |

## Self-review

- Update all `updateTicket` / `assignTicket` call sites (specs, agent UI still works via same API with auth — agent managers must be operable on property).
- Agent web already calls update/assign; with manage-scope, agents only succeed if `AgencyAccessService` allows — correct for mandated assignment model.
