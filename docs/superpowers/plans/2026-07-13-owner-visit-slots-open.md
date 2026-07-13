# Owner Visit Slots Open / Block / Unblock Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let owners open one-off AVAILABLE visit slots, list all upcoming statuses, block/unblock — with a sparse mobile-like owner page.

**Architecture:** Extend `VisitSlotsService` with `openSlot`, `unblockSlot`, `listManagedSlots` (AgencyAccess already wired). Mirror `blockSlot` upsert pattern. Reorder owner visit-slots page: open form → managed list → secondary block range → demoted templates.

**Tech Stack:** NestJS, Prisma `VisitSlot` / `VisitSlotStatus` / `VisitSlotSource`, Jest, Next.js owner dashboard.

**Spec:** `docs/superpowers/specs/2026-07-13-owner-visit-slots-open-design.md`

## Global Constraints

- One-off open only (templates stay, demoted in UI).
- `visitEnabled` required for open.
- Never mutate `BOOKED` via open/unblock.
- Public `GET …/visit-slots` stays AVAILABLE-only.
- UI: sparse, mobile-like — open CTA above the fold; no new palette; no month calendar.
- French UI copy; English routes.
- Register `…/visit-slots/managed` **before** public `…/visit-slots` if both share a prefix (Nest static segment safety).

## File map

| Path | Responsibility |
|------|----------------|
| `apps/api/src/visit-slots/visit-slots.service.ts` | `openSlot`, `unblockSlot`, `listManagedSlots` |
| `apps/api/src/visit-slots/visit-slots.controller.ts` | New routes + DTO reuse |
| `apps/api/src/visit-slots/visit-slots-manual.spec.ts` | New suite (open/unblock/managed) |
| `apps/api/openapi.json` | Export |
| `apps/web/lib/owner/visit-slots.ts` | Client helpers |
| `apps/web/app/owner/properties/[id]/visit-slots/owner-visit-slots.tsx` | Sparse UI rewrite |

---

### Task 1: API — `openSlot` + `unblockSlot` (TDD)

**Files:**
- Create: `apps/api/src/visit-slots/visit-slots-manual.spec.ts`
- Modify: `apps/api/src/visit-slots/visit-slots.service.ts`
- Modify: `apps/api/src/visit-slots/visit-slots.controller.ts`

**Interfaces:**
- Produces:
  - `openSlot(userId, propertyId, { startAt: Date; endAt: Date }): Promise<PublicVisitSlot>`
  - `unblockSlot(userId, slotId): Promise<PublicVisitSlot>`

- [ ] **Step 1: Create failing test file** `visit-slots-manual.spec.ts` (fixtures patterned on `visit-bookings.spec.ts`, unique phones):

```typescript
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { VisitSlotsService } from './visit-slots.service';

describe('VisitSlotsService — manual open/unblock', () => {
  let slots: VisitSlotsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let propertyId: string;
  const createdSlotIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VisitSlotsService,
        AgencyAccessService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    slots = moduleRef.get(VisitSlotsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    await prisma.user.deleteMany({ where: { phone: '+242071000011' } });
    const owner = await prisma.user.create({
      data: {
        phone: '+242071000011',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Visit Manual Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const prop = await prisma.property.create({
      data: {
        title: 'Visit Manual Open',
        description: 'Open/unblock tests',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'Y',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
        visitEnabled: true,
        visitType: 'FREE',
        visitDuration: 30,
      },
    });
    propertyId = prop.id;
  });

  afterAll(async () => {
    if (createdSlotIds.length) {
      await prisma.visitSlot
        .deleteMany({ where: { id: { in: createdSlotIds } } })
        .catch(() => undefined);
    }
    await prisma.visitSlot
      .deleteMany({ where: { propertyId } })
      .catch(() => undefined);
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({ where: { userId: ownerUserId } })
      .catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { members: { none: {} } } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: ownerUserId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  it('openSlot creates AVAILABLE MANUAL slot', async () => {
    const startAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const slot = await slots.openSlot(ownerUserId, propertyId, { startAt, endAt });
    createdSlotIds.push(slot.id);
    expect(slot.status).toBe('AVAILABLE');
    expect(slot.source).toBe('MANUAL');
  });

  it('openSlot rejects BOOKED conflict', async () => {
    const startAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const booked = await prisma.visitSlot.create({
      data: {
        propertyId,
        startAt,
        endAt,
        status: 'BOOKED',
        source: 'MANUAL',
      },
    });
    createdSlotIds.push(booked.id);
    await expect(
      slots.openSlot(ownerUserId, propertyId, { startAt, endAt }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('unblockSlot flips BLOCKED to AVAILABLE', async () => {
    const startAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const blocked = await slots.blockSlot(ownerUserId, propertyId, {
      startAt,
      endAt,
    });
    createdSlotIds.push(blocked.id);
    const opened = await slots.unblockSlot(ownerUserId, blocked.id);
    expect(opened.status).toBe('AVAILABLE');
  });

  it('unblockSlot rejects non-BLOCKED', async () => {
    const startAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const slot = await slots.openSlot(ownerUserId, propertyId, { startAt, endAt });
    createdSlotIds.push(slot.id);
    await expect(
      slots.unblockSlot(ownerUserId, slot.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/visit-slots/visit-slots-manual.spec.ts --runInBand
```

Expected: FAIL (`openSlot` / `unblockSlot` undefined).

- [ ] **Step 3: Implement service methods** (after `blockSlot` in `visit-slots.service.ts`):

```typescript
  async openSlot(
    userId: string,
    propertyId: string,
    input: { startAt: Date; endAt: Date },
  ): Promise<PublicVisitSlot> {
    await this.assertCanManageProperty(userId, propertyId);
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { visitEnabled: true },
    });
    if (!property?.visitEnabled) {
      throw new BadRequestException({
        code: 'VISITS_DISABLED',
        message: 'Visits are not enabled for this property',
      });
    }
    if (input.endAt <= input.startAt) {
      throw new BadRequestException({
        code: 'INVALID_SLOT_RANGE',
        message: 'endAt must be after startAt',
      });
    }
    const existing = await this.prisma.visitSlot.findUnique({
      where: {
        propertyId_startAt: { propertyId, startAt: input.startAt },
      },
    });
    if (existing?.status === VisitSlotStatus.BOOKED) {
      throw new ConflictException({
        code: 'SLOT_BOOKED',
        message: 'Cannot open a slot that is already booked',
      });
    }
    const saved = await this.prisma.visitSlot.upsert({
      where: {
        propertyId_startAt: { propertyId, startAt: input.startAt },
      },
      create: {
        propertyId,
        startAt: input.startAt,
        endAt: input.endAt,
        status: VisitSlotStatus.AVAILABLE,
        source: VisitSlotSource.MANUAL,
      },
      update: {
        endAt: input.endAt,
        status: VisitSlotStatus.AVAILABLE,
        source: VisitSlotSource.MANUAL,
      },
    });
    return this.slotToPublic(saved);
  }

  async unblockSlot(
    userId: string,
    slotId: string,
  ): Promise<PublicVisitSlot> {
    const slot = await this.prisma.visitSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) {
      throw new NotFoundException({
        code: 'SLOT_NOT_FOUND',
        message: 'Visit slot does not exist',
      });
    }
    await this.assertCanManageProperty(userId, slot.propertyId);
    if (slot.status !== VisitSlotStatus.BLOCKED) {
      throw new BadRequestException({
        code: 'SLOT_NOT_BLOCKED',
        message: 'Only blocked slots can be unblocked',
      });
    }
    const updated = await this.prisma.visitSlot.update({
      where: { id: slotId },
      data: { status: VisitSlotStatus.AVAILABLE },
    });
    return this.slotToPublic(updated);
  }
```

- [ ] **Step 4: Wire controller** — reuse `BlockSlotDto` for open body; add routes **above** public `GET …/visit-slots`:

```typescript
  @Post('properties/:id/visit-slots/open')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Open a one-off available visit slot' })
  openSlot(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BlockSlotDto,
  ) {
    return this.slots.openSlot(current.userId, id, {
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });
  }

  @Post('visit-slots/:id/unblock')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unblock a blocked visit slot' })
  unblockSlot(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.slots.unblockSlot(current.userId, id);
  }
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd apps/api && bunx jest src/visit-slots/visit-slots-manual.spec.ts --runInBand
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/visit-slots/visit-slots.service.ts apps/api/src/visit-slots/visit-slots.controller.ts apps/api/src/visit-slots/visit-slots-manual.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): open and unblock manual visit slots

EOF
)"
```

---

### Task 2: API — `listManagedSlots` (TDD)

**Files:**
- Modify: `apps/api/src/visit-slots/visit-slots.service.ts`
- Modify: `apps/api/src/visit-slots/visit-slots.controller.ts`
- Modify: `apps/api/src/visit-slots/visit-slots-manual.spec.ts`

**Interfaces:**
- Produces: `listManagedSlots(userId, propertyId, opts?: { from?: Date; to?: Date }): Promise<PublicVisitSlot[]>`

- [ ] **Step 1: Add failing tests**

```typescript
  it('listManagedSlots returns AVAILABLE BLOCKED and BOOKED', async () => {
    const base = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const mk = async (offsetH: number, status: 'AVAILABLE' | 'BLOCKED' | 'BOOKED') => {
      const startAt = new Date(base + offsetH * 3600_000);
      startAt.setUTCSeconds(0, 0);
      const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
      const row = await prisma.visitSlot.create({
        data: {
          propertyId,
          startAt,
          endAt,
          status,
          source: 'MANUAL',
        },
      });
      createdSlotIds.push(row.id);
      return row;
    };
    await mk(0, 'AVAILABLE');
    await mk(1, 'BLOCKED');
    await mk(2, 'BOOKED');

    const listed = await slots.listManagedSlots(ownerUserId, propertyId, {
      from: new Date(base - 60_000),
    });
    const statuses = new Set(listed.map((s) => s.status));
    expect(statuses.has('AVAILABLE')).toBe(true);
    expect(statuses.has('BLOCKED')).toBe(true);
    expect(statuses.has('BOOKED')).toBe(true);
  });
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/visit-slots/visit-slots-manual.spec.ts -t "listManagedSlots" --runInBand
```

- [ ] **Step 3: Implement**

```typescript
  async listManagedSlots(
    userId: string,
    propertyId: string,
    opts: { from?: Date; to?: Date } = {},
  ): Promise<PublicVisitSlot[]> {
    await this.assertCanManageProperty(userId, propertyId);
    const from = opts.from ?? new Date();
    const rows = await this.prisma.visitSlot.findMany({
      where: {
        propertyId,
        startAt: { gte: from },
        ...(opts.to ? { endAt: { lte: opts.to } } : {}),
      },
      orderBy: { startAt: 'asc' },
    });
    return rows.map((s) => this.slotToPublic(s));
  }
```

Controller (place **before** public `GET properties/:id/visit-slots`):

```typescript
  @Get('properties/:id/visit-slots/managed')
  @UseGuards(AppAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all upcoming visit slots for managers' })
  listManaged(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: AvailableSlotsQueryDto,
  ) {
    return this.slots.listManagedSlots(current.userId, id, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
```

- [ ] **Step 4: Run full manual suite — PASS**

```bash
cd apps/api && bunx jest src/visit-slots/visit-slots-manual.spec.ts --runInBand
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/visit-slots/visit-slots.service.ts apps/api/src/visit-slots/visit-slots.controller.ts apps/api/src/visit-slots/visit-slots-manual.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): list managed visit slots for property owners

EOF
)"
```

---

### Task 3: OpenAPI export

**Files:**
- Modify: `apps/api/openapi.json`

- [ ] **Step 1:**

```bash
cd apps/api && bun run export:openapi
```

- [ ] **Step 2:** Confirm paths for `open`, `unblock`, `managed` exist in `openapi.json`.

- [ ] **Step 3: Commit**

```bash
git add apps/api/openapi.json
git commit -m "$(cat <<'EOF'
chore(api): export OpenAPI for visit slot open unblock managed

EOF
)"
```

---

### Task 4: Web client helpers

**Files:**
- Modify: `apps/web/lib/owner/visit-slots.ts`

**Interfaces:**
- Produces: `openSlot`, `unblockSlot`, `listManagedSlots`

- [ ] **Step 1: Append helpers** (keep existing exports):

```typescript
export async function openSlot(
  propertyId: string,
  body: { startAt: string; endAt: string },
): Promise<PublicVisitSlot> {
  return apiFetch<PublicVisitSlot>(
    `/properties/${propertyId}/visit-slots/open`,
    { method: 'POST', body },
  );
}

export async function unblockSlot(slotId: string): Promise<PublicVisitSlot> {
  return apiFetch<PublicVisitSlot>(`/visit-slots/${slotId}/unblock`, {
    method: 'POST',
  });
}

export async function listManagedSlots(
  propertyId: string,
  from?: string,
  to?: string,
): Promise<PublicVisitSlot[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString();
  return apiFetch<PublicVisitSlot[]>(
    `/properties/${propertyId}/visit-slots/managed${qs ? `?${qs}` : ''}`,
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/owner/visit-slots.ts
git commit -m "$(cat <<'EOF'
feat(web): owner visit slot open unblock managed helpers

EOF
)"
```

---

### Task 5: Sparse owner visit-slots page

**Files:**
- Modify: `apps/web/app/owner/properties/[id]/visit-slots/owner-visit-slots.tsx`

**UI order (required):** header → open form → À venir list → block range (secondary) → templates (secondary).

- [ ] **Step 1: Update imports** — add `openSlot`, `unblockSlot`, `listManagedSlots`; keep template + `blockSlot` helpers.

- [ ] **Step 2: State for open form**

```typescript
  const [openStart, setOpenStart] = useState('');
  const [openMinutes, setOpenMinutes] = useState(30);
  const [opening, setOpening] = useState(false);
```

- [ ] **Step 3: `load` uses managed list**

```typescript
      const from = new Date().toISOString();
      const [tmpl, upcoming] = await Promise.all([
        listTemplates(propertyId),
        listManagedSlots(propertyId, from),
      ]);
```

- [ ] **Step 4: Handlers**

```typescript
  const handleOpen = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!openStart) return;
      setOpening(true);
      try {
        const startAt = new Date(openStart);
        const endAt = new Date(startAt.getTime() + openMinutes * 60_000);
        await openSlot(propertyId, {
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });
        setOpenStart('');
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’ouvrir le créneau.',
        );
      } finally {
        setOpening(false);
      }
    },
    [load, openMinutes, openStart, propertyId],
  );

  const handleBlockRow = useCallback(
    async (slot: PublicVisitSlot) => {
      setActionId(slot.id);
      try {
        await blockSlot(propertyId, slot.startAt, slot.endAt);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de bloquer le créneau.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load, propertyId],
  );

  const handleUnblockRow = useCallback(
    async (slot: PublicVisitSlot) => {
      setActionId(slot.id);
      try {
        await unblockSlot(slot.id);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de débloquer le créneau.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );
```

- [ ] **Step 5: Reorder JSX** (after `visitEnabled` gate) — keep existing `DashboardPageHeader` / error banner; then:

1. **Ouvrir un créneau** — light section, not a heavy bordered card stack:

```tsx
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-heading">Ouvrir un créneau</h2>
        <p className="text-sm text-muted">
          Choisissez une date et une durée pour proposer une visite.
        </p>
        <form
          onSubmit={(e) => void handleOpen(e)}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Début</span>
            <input
              type="datetime-local"
              required
              value={openStart}
              onChange={(e) => setOpenStart(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 sm:w-auto"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Durée (min)</span>
            <input
              type="number"
              min={15}
              step={15}
              value={openMinutes}
              onChange={(e) => setOpenMinutes(Number(e.target.value) || 30)}
              className="w-28 rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={opening}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {opening ? 'Ouverture…' : 'Ouvrir'}
          </button>
        </form>
      </section>
```

2. **À venir** — existing `slotColumns` + actions:

```tsx
        actions={(row) => {
          if (row.status === 'AVAILABLE') {
            return (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleBlockRow(row)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-card-hover disabled:opacity-50"
              >
                Bloquer
              </button>
            );
          }
          if (row.status === 'BLOCKED') {
            return (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleUnblockRow(row)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-card-hover disabled:opacity-50"
              >
                Débloquer
              </button>
            );
          }
          return null;
        }}
```

Title the table section `À venir` (not only AVAILABLE).

3. Move **Bloquer une plage** form below the list; keep compact.

4. Move **Modèles hebdomadaires** + create form to the **bottom**; optional `<details>`:

```tsx
      <details className="space-y-4 pt-4">
        <summary className="cursor-pointer text-sm font-medium text-muted">
          Modèles hebdomadaires
        </summary>
        {/* existing template table + create form */}
      </details>
```

- [ ] **Step 6: Smoke** — open page in browser mentally: first content after header must be “Ouvrir un créneau”.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/owner/properties/[id]/visit-slots/owner-visit-slots.tsx
git commit -m "$(cat <<'EOF'
feat(web): sparse owner visit slots open block unblock UI

EOF
)"
```

---

## Spec coverage (self-review)

| Spec item | Task |
|-----------|------|
| `open` endpoint | 1 |
| `unblock` endpoint | 1 |
| `managed` list | 2 |
| OpenAPI | 3 |
| Client helpers | 4 |
| Sparse UI hierarchy + actions | 5 |
| Templates demoted | 5 |
| Out of scope calendar / slice 7 | not tasked |

No TBD. Names: `openSlot` / `unblockSlot` / `listManagedSlots` consistent across API, helpers, UI.
