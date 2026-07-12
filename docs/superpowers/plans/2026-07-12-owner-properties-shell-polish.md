# Owner Properties / Shell Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add publish/pause property status APIs and polish owner list/detail plus remove fake dashboard chrome.

**Architecture:** Mirror existing `archive` on `PropertiesService`/`PropertiesController` for `publish` and `pause`. Web client helpers call the new routes; owner list/detail surfaces status actions and a media thumb. Shared topbar/sidebar drop non-functional search, fake notification badge, and decorative nav counts.

**Tech Stack:** NestJS, Prisma `PropertyStatus`, Jest + supertest, Next.js owner dashboard, existing `ListDataTable` / `DashboardPageHeader`.

**Spec:** `docs/superpowers/specs/2026-07-12-owner-properties-shell-polish-design.md`

## Global Constraints

- Same write auth as archive: `assertCanWrite` (owner or org member) — do not invent a new access path.
- Invalid transitions → `400` with `code: 'INVALID_STATUS_TRANSITION'`.
- Publish/pause must **not** change `listingStatus`.
- No un-archive in this slice.
- French UI copy; English URL paths.
- Out of scope: media delete/reorder, create-form redesign, live search/notifications, leases/maintenance/payments.

## File map

| Path | Responsibility |
|------|----------------|
| `apps/api/src/properties/properties.service.ts` | `publish`, `pause` next to `archive` |
| `apps/api/src/properties/properties.controller.ts` | `POST :id/publish`, `POST :id/pause` |
| `apps/api/src/properties/properties.spec.ts` | Transition + auth tests |
| `apps/web/lib/owner/properties.ts` | `publishProperty`, `pauseProperty` |
| `apps/web/app/owner/properties/owner-properties.tsx` | Thumb column, row actions, empty CTA |
| `apps/web/app/owner/properties/[id]/owner-property-detail.tsx` | Header actions, breadcrumb, error banner |
| `apps/web/components/dashboard/list-data-table.tsx` | Allow `emptyMessage` as `ReactNode` |
| `apps/web/components/dashboard/topbar.tsx` | Remove dead search + fake badge |
| `apps/web/components/dashboard/sidebar-nav.tsx` | Remove `NAV_BADGES` |
| `apps/api/openapi.json` | Export after API routes |

---

### Task 1: API — publish + pause (TDD)

**Files:**
- Modify: `apps/api/src/properties/properties.service.ts`
- Modify: `apps/api/src/properties/properties.controller.ts`
- Modify: `apps/api/src/properties/properties.spec.ts`

**Interfaces:**
- Produces: `publish(userId, id): Promise<PublicProperty>`, `pause(userId, id): Promise<PublicProperty>`
- Consumes: existing `assertCanWrite`, `getOne`, `publicInclude`, `PropertyStatus`

- [ ] **Step 1: Write failing tests** in `properties.spec.ts` (after the archive test, before RBAC). Use the suite’s existing `createdPropertyId` / `ownerUserId` / `outsiderUserId` / `app` / `prisma`. Reset status explicitly in each test:

```typescript
  it('POST /properties/:id/publish moves DRAFT to ACTIVE', async () => {
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'DRAFT' },
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${createdPropertyId}/publish`)
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('POST /properties/:id/pause moves ACTIVE to PAUSED', async () => {
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'ACTIVE' },
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${createdPropertyId}/pause`)
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(res.body.status).toBe('PAUSED');
  });

  it('POST /properties/:id/publish from PAUSED returns ACTIVE', async () => {
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'PAUSED' },
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${createdPropertyId}/publish`)
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('POST /properties/:id/publish from ARCHIVED returns 400 INVALID_STATUS_TRANSITION', async () => {
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'ARCHIVED' },
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${createdPropertyId}/publish`)
      .set('x-test-user', ownerUserId)
      .expect(400);
    expect(res.body.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('POST /properties/:id/pause from DRAFT returns 400', async () => {
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'DRAFT' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${createdPropertyId}/pause`)
      .set('x-test-user', ownerUserId)
      .expect(400);
  });

  it('POST /properties/:id/publish rejects non-owner (403)', async () => {
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'DRAFT' },
    });
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${createdPropertyId}/publish`)
      .set('x-test-user', outsiderUserId)
      .expect(403);
  });
```

- [ ] **Step 2: Run tests — expect FAIL** (404 / missing routes)

```bash
cd apps/api && bunx jest src/properties/properties.spec.ts --runInBand
```

Expected: new tests fail (route not found or method missing).

- [ ] **Step 3: Implement service methods** (place after `archive` in `properties.service.ts`)

```typescript
  async publish(userId: string, id: string): Promise<PublicProperty> {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    await this.assertCanWrite(
      userId,
      existing.ownerId,
      existing.organizationId,
    );
    if (
      existing.status !== PropertyStatus.DRAFT &&
      existing.status !== PropertyStatus.PAUSED
    ) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Only DRAFT or PAUSED properties can be published',
      });
    }
    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: PropertyStatus.ACTIVE },
      include: this.publicInclude(),
    });
    return this.toPublic(updated);
  }

  async pause(userId: string, id: string): Promise<PublicProperty> {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    await this.assertCanWrite(
      userId,
      existing.ownerId,
      existing.organizationId,
    );
    if (existing.status !== PropertyStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'INVALID_STATUS_TRANSITION',
        message: 'Only ACTIVE properties can be paused',
      });
    }
    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: PropertyStatus.PAUSED },
      include: this.publicInclude(),
    });
    return this.toPublic(updated);
  }
```

Ensure `BadRequestException` is imported from `@nestjs/common` if missing.

- [ ] **Step 4: Wire controller** (after archive handler)

```typescript
  @Post(':id/publish')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish a DRAFT or PAUSED property (→ ACTIVE)' })
  publish(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.properties.publish(current.userId, id);
  }

  @Post(':id/pause')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Pause an ACTIVE property' })
  pause(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.properties.pause(current.userId, id);
  }
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd apps/api && bunx jest src/properties/properties.spec.ts --runInBand
```

Expected: all properties tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/properties/properties.service.ts \
  apps/api/src/properties/properties.controller.ts \
  apps/api/src/properties/properties.spec.ts
git commit -m "feat(api): publish and pause property status transitions"
```

---

### Task 2: Web client helpers

**Files:**
- Modify: `apps/web/lib/owner/properties.ts`

**Interfaces:**
- Consumes: `POST /properties/:id/publish`, `POST /properties/:id/pause`
- Produces: `publishProperty(id)`, `pauseProperty(id)` returning `Promise<PublicProperty>`

- [ ] **Step 1: Add helpers** next to `archiveProperty`

```typescript
export async function publishProperty(id: string): Promise<PublicProperty> {
  return apiFetch<PublicProperty>(`/properties/${id}/publish`, {
    method: 'POST',
  });
}

export async function pauseProperty(id: string): Promise<PublicProperty> {
  return apiFetch<PublicProperty>(`/properties/${id}/pause`, {
    method: 'POST',
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/owner/properties.ts
git commit -m "feat(web): client helpers for property publish and pause"
```

---

### Task 3: Owner properties list polish

**Files:**
- Modify: `apps/web/components/dashboard/list-data-table.tsx` (`emptyMessage` type)
- Modify: `apps/web/app/owner/properties/owner-properties.tsx`

**Interfaces:**
- Consumes: `listMyProperties`, `publishProperty`, `archiveProperty`, `PublicProperty.media`
- Produces: list UI with thumb + status actions + empty CTA

- [ ] **Step 1: Allow ReactNode empty message** in `list-data-table.tsx`

Change prop type:

```typescript
  emptyMessage?: React.ReactNode;
```

(Keep default string; `{emptyMessage}` already renders as children.)

- [ ] **Step 2: Update list page** — add photo column, actions, busy state, empty CTA

In `owner-properties.tsx`:

1. Import `publishProperty`, `archiveProperty`.
2. Add `actionId` state (`string | null`) for in-flight row actions.
3. Insert photo column as first column:

```tsx
{
  key: 'media',
  label: 'Photo',
  className: 'w-16',
  render: (_value, row) => {
    const url = row.media?.slice().sort((a, b) => a.position - b.position)[0]
      ?.url;
    return url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="size-10 rounded-md object-cover"
      />
    ) : (
      <span className="inline-flex size-10 items-center justify-center rounded-md bg-card-hover text-[10px] text-muted">
        —
      </span>
    );
  },
},
```

4. Replace `actions` prop with:

```tsx
actions={(row) => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Link
      href={ROUTES.owner.property(row.id)}
      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
    >
      Voir
    </Link>
    <Link
      href={ROUTES.owner.property(row.id)}
      className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
    >
      Éditer
    </Link>
    {row.status === 'DRAFT' || row.status === 'PAUSED' ? (
      <button
        type="button"
        disabled={actionId === row.id}
        onClick={() => void handlePublish(row.id)}
        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
      >
        Publier
      </button>
    ) : null}
    {row.status !== 'ARCHIVED' ? (
      <button
        type="button"
        disabled={actionId === row.id}
        onClick={() => void handleArchive(row.id)}
        className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
      >
        Archiver
      </button>
    ) : null}
  </div>
)}
```

5. Handlers:

```typescript
  const handlePublish = useCallback(
    async (id: string) => {
      setActionId(id);
      try {
        await publishProperty(id);
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de publier le bien.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const handleArchive = useCallback(
    async (id: string) => {
      if (!confirm('Archiver ce bien ?')) return;
      setActionId(id);
      try {
        await archiveProperty(id);
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’archiver le bien.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );
```

6. Empty state — pass:

```tsx
emptyMessage={
  <span className="inline-flex flex-col items-center gap-3 py-2">
    <span>Vous n’avez pas encore de bien.</span>
    <Link
      href={ROUTES.owner.propertiesAdd}
      className="inline-flex items-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
    >
      Ajouter un bien
    </Link>
  </span>
}
```

- [ ] **Step 3: Manual smoke** — login as `owner@paradisimmo.cg` / `Owner123!`, open `/owner/properties`, confirm thumb/placeholder and actions render.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/dashboard/list-data-table.tsx \
  apps/web/app/owner/properties/owner-properties.tsx
git commit -m "feat(web): polish owner properties list thumbs and actions"
```

---

### Task 4: Owner property detail polish

**Files:**
- Modify: `apps/web/app/owner/properties/[id]/owner-property-detail.tsx`

**Interfaces:**
- Consumes: `publishProperty`, `pauseProperty`, `archiveProperty`, `DashboardPageHeader` `breadcrumb` override
- Produces: status-aware header actions + titled breadcrumb

- [ ] **Step 1: Import helpers + StatusBadge already present; add publish/pause**

Add imports for `publishProperty`, `pauseProperty`. Add `statusBusy` state (boolean) or reuse `archiving` as `statusBusy`.

- [ ] **Step 2: Header** — when `property` is loaded, pass:

```tsx
<DashboardPageHeader
  title={property.title}
  breadcrumb={[
    { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
    { label: 'Mes biens', href: ROUTES.owner.properties },
    { label: property.title.length > 40
        ? `${property.title.slice(0, 40)}…`
        : property.title },
  ]}
  actions={
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge
        label={propertyStatusLabel(property.status)}
        tone={propertyStatusTone(property.status)}
      />
      {property.status === 'DRAFT' || property.status === 'PAUSED' ? (
        <button
          type="button"
          disabled={statusBusy}
          onClick={() => void handlePublish()}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          Publier
        </button>
      ) : null}
      {property.status === 'ACTIVE' ? (
        <button
          type="button"
          disabled={statusBusy}
          onClick={() => void handlePause()}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
        >
          Mettre en pause
        </button>
      ) : null}
      {property.status !== 'ARCHIVED' ? (
        <button
          type="button"
          disabled={statusBusy}
          onClick={() => void handleArchive()}
          className="rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
        >
          Archiver
        </button>
      ) : null}
    </div>
  }
/>
```

Wire `handlePublish` / `handlePause` / keep archive confirm; on success call `load()` and clear error.

Check `ROUTES.owner.dashboard` / `properties` exist in `apps/web/lib/routes.ts` — use the same path strings already used elsewhere if helpers differ (`/owner/dashboard`, `/owner/properties`).

- [ ] **Step 3: Loading / error** — while loading show muted « Chargement… »; on error (with or without property) show the same danger banner as the list (`role="alert"`, `border-danger/30 bg-danger/10`). Do not leave a blank screen on failure.

- [ ] **Step 4: Smoke** — publish a draft from detail, pause, republish.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/owner/properties/[id]/owner-property-detail.tsx
git commit -m "feat(web): owner property detail status actions and breadcrumb"
```

---

### Task 5: Shell chrome cleanup

**Files:**
- Modify: `apps/web/components/dashboard/topbar.tsx`
- Modify: `apps/web/components/dashboard/sidebar-nav.tsx`

**Interfaces:**
- Produces: topbar without dead search / fake badge `5`; sidebar without decorative counts

- [ ] **Step 1: Topbar** — remove the search `<div className="relative hidden…">` block entirely. Remove the notification button (or keep bell **without** the `<span>…5</span>` badge — prefer **remove the whole notifications control** until real notifications exist, per “no fake chrome”).

Keep: menu, RoleSwitcher, theme toggle, logout.

- [ ] **Step 2: Sidebar** — delete `NAV_BADGES` constant and any `badge` rendering in the link (the trailing count span). Leave icons + labels only.

- [ ] **Step 3: Visual check** — `/owner/dashboard` and `/owner/properties` show no search field, no red `5`, no `01`/`03` nav pills.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/dashboard/topbar.tsx \
  apps/web/components/dashboard/sidebar-nav.tsx
git commit -m "fix(web): remove fake dashboard search and nav badges"
```

---

### Task 6: OpenAPI export

**Files:**
- Modify: `apps/api/openapi.json` (generated)

- [ ] **Step 1: Export**

```bash
cd apps/api && bun run export:openapi
```

- [ ] **Step 2: Verify** `openapi.json` contains `/api/v1/properties/{id}/publish` and `/api/v1/properties/{id}/pause`.

- [ ] **Step 3: Commit if changed**

```bash
git add apps/api/openapi.json
git commit -m "chore(api): export OpenAPI for property publish and pause"
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| `POST …/publish`, `POST …/pause`, invalid transition | 1 |
| Client helpers | 2 |
| List thumb, actions, empty CTA | 3 |
| Detail header actions, breadcrumb, error chrome | 4 |
| Shell search / notif badge / nav badges | 5 |
| OpenAPI | 6 |

## Self-review notes

- No placeholders; auth reuses `assertCanWrite`.
- `emptyMessage` ReactNode is a one-line shared type widen — needed for empty CTA without a new empty-state component.
- Pause is detail-only in the UI (list has publish + archive); matches spec detail table; list does not need pause for success criteria.
