# Web MVP Product — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-usable web back-office for owner, agent, and admin across all property modes (including multi-image upload), plus a landing teaser that loads live ACTIVE listings and CTAs to the mobile app.

**Architecture:** Next.js App Router + NextAuth session (access/refresh) + `apiFetch` to Nest. New list endpoints for mine/managed resources. Shared `ListDataTable` / `PaginatedDataTable`. Media via R2 presign/confirm.

**Tech Stack:** Next.js 16, NextAuth v5, Tailwind v4, NestJS, Prisma, Cloudflare R2.

**Spec:** `docs/superpowers/specs/2026-07-04-web-mvp-product-design.md`

## Global Constraints

- English routes (`/owner`, `/agent`, `/admin`); French UI copy.
- No placeholder pages left in sidebar nav for in-scope features.
- Prefer existing APIs; only add endpoints listed in the spec.
- Reuse dashboard components and Darkone tokens.
- Do not implement mobile app screens in this plan.
- Commit after each task when executing (user must confirm commits if their rules require it).

---

### Task 1: API `GET /properties/mine`

**Files:**
- Modify: `apps/api/src/properties/properties.service.ts`
- Modify: `apps/api/src/properties/properties.controller.ts`
- Modify: `apps/api/src/properties/properties.spec.ts`
- Run: `pnpm export:openapi` + `pnpm generate:types` (optional if web uses hand-written types)

**Interfaces:**
- Produces: `PropertiesService.listMine(userId: string): Promise<PublicProperty[]>`
- Route: `GET /properties/mine` (must be registered **before** `GET /properties/:id`)

- [ ] **Step 1: Add service method**

```ts
async listMine(userId: string): Promise<PublicProperty[]> {
  const rows = await this.prisma.property.findMany({
    where: { ownerId: userId },
    include: this.publicInclude(),
    orderBy: { createdAt: 'desc' },
  });
  return rows.map((p) => this.toPublic(p));
}
```

- [ ] **Step 2: Add controller route before `:id`**

```ts
@Get('mine')
@UseGuards(AppAuthGuard)
listMine(@CurrentUser() current: AuthenticatedUser) {
  return this.properties.listMine(current.userId);
}
```

- [ ] **Step 3: Integration test** — authenticated owner sees only own properties

Run: `pnpm --filter api test -- properties.spec.ts`  
Expected: PASS

- [ ] **Step 4: Commit** `feat(api): list properties owned by current user`

---

### Task 2: Web owner property list + create (no media yet)

**Files:**
- Create: `apps/web/lib/owner/properties.ts`
- Create: `apps/web/app/owner/properties/owner-properties.tsx`
- Create: `apps/web/app/owner/properties/owner-property-form.tsx`
- Modify: `apps/web/app/owner/properties/page.tsx`
- Modify: `apps/web/app/owner/properties/add/page.tsx`

**Interfaces:**
- Consumes: `GET /properties/mine`, `POST /properties`, locations endpoints
- Produces: `listMyProperties()`, `createProperty(input)`, form fields matching `CreatePropertyDto`

- [ ] **Step 1: Client helpers** in `lib/owner/properties.ts` using `apiFetch`

```ts
export async function listMyProperties(): Promise<PublicProperty[]> {
  return apiFetch<PublicProperty[]>('/properties/mine');
}

export async function createProperty(body: CreatePropertyInput): Promise<PublicProperty> {
  return apiFetch<PublicProperty>('/properties', { method: 'POST', body });
}
```

- [ ] **Step 2: List page** — `ListDataTable`, columns title, mode, status, price; CTA « Ajouter un bien » → `/owner/properties/add`; `useRequireSession`

- [ ] **Step 3: Create form** — all modes/types, price, currency, priceUnit, address, countryId (CG from seed), quartier select (load `GET /locations/quartiers` or cities→arrondissements→quartiers), visitEnabled optional

- [ ] **Step 4: Manual** — login owner seed, create RENT_LONG, see in list

- [ ] **Step 5: Commit** `feat(web): owner property list and create form`

---

### Task 3: Property detail + multi-image upload

**Files:**
- Create: `apps/web/lib/owner/media.ts`
- Create: `apps/web/components/owner/property-media-uploader.tsx`
- Create: `apps/web/app/owner/properties/[id]/owner-property-detail.tsx`
- Modify: `apps/web/app/owner/properties/[id]/page.tsx`

**Interfaces:**
- Consumes: `GET /properties/:id`, `GET|POST /properties/:id/media`, `presign`, `confirm`
- Produces: `presignMedia`, `confirmMedia`, `listMedia`, uploader component

- [ ] **Step 1: Media helpers**

```ts
export async function presignMedia(propertyId: string, input: {
  contentType: string;
  fileName: string;
}) {
  return apiFetch<{ uploadUrl: string; fileUrl: string; key: string }>(
    `/properties/${propertyId}/media/presign`,
    { method: 'POST', body: input },
  );
}

export async function confirmMedia(propertyId: string, input: {
  url: string;
  type: 'IMAGE' | 'VIDEO';
  position: number;
}) {
  return apiFetch(`/properties/${propertyId}/media/confirm`, {
    method: 'POST',
    body: input,
  });
}
```

(Adjust field names to match `PresignMediaDto` / `ConfirmMediaDto` in API.)

- [ ] **Step 2: Uploader** — `<input type="file" multiple accept="image/*" />`; for each file: presign → `fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })` → confirm; show progress/errors per file

- [ ] **Step 3: Detail page** — property fields + gallery + uploader + link to visit-slots

- [ ] **Step 4: Manual** — upload 2 images with R2 configured; without R2, show API error message

- [ ] **Step 5: Commit** `feat(web): property detail and R2 image upload`

---

### Task 4: Owner visit slots page

**Files:**
- Create: `apps/web/lib/owner/visit-slots.ts`
- Create: `apps/web/app/owner/properties/[id]/visit-slots/owner-visit-slots.tsx`
- Modify: `apps/web/app/owner/properties/[id]/visit-slots/page.tsx`

**Interfaces:**
- Consumes: visit-templates and visit-slots endpoints under `/properties/:id/...`

- [ ] **Step 1: Helpers** list/create template, list slots, block slot if needed

- [ ] **Step 2: UI** — table of templates; form dayOfWeek (0–6), startTime, endTime, slotMinutes; list upcoming slots

- [ ] **Step 3: Guard** — if property `!visitEnabled`, show message to enable visits on property

- [ ] **Step 4: Commit** `feat(web): owner visit slot templates`

---

### Task 5: API `GET /leases/managed` + owner leases & visits & payments & maintenance & mandate

**Files:**
- Modify: `apps/api/src/leases/leases.service.ts`, `leases.controller.ts`, `leases` specs
- Create: `apps/web/lib/owner/leases.ts`, `visits.ts` (or reuse agent visits), `payments.ts`, `maintenance.ts`, `mandates.ts`
- Replace placeholders under:
  - `apps/web/app/owner/leases/`
  - `apps/web/app/owner/visits/`
  - `apps/web/app/owner/payments/`
  - `apps/web/app/owner/maintenance/`
  - `apps/web/app/owner/mandate/`

**Interfaces:**
- `LeasesService.listManaged(userId)` — leases where property.ownerId = userId OR property.organization has user as member
- Mandate: existing `GET /mandates/pending-approvals`, `PATCH /mandates/approvals/:id`
- Visits: reuse `listManagedVisits`, `confirmVisit`, `cancelVisit` from `lib/agent/visits.ts` (move to `lib/visits.ts` if shared)

- [ ] **Step 1: API leases managed + test**

- [ ] **Step 2: Owner visits page** — copy patterns from agent visits

- [ ] **Step 3: Owner leases table**

- [ ] **Step 4: Owner payments** — `GET /payments/my` is tenant-centric; for owner income view, if no endpoint, list allocations is out of scope — show payments for tenants on managed leases only if API allows. **Minimum:** page lists `GET /payments/my` with note for tenant role OR implement `GET /payments/managed` if product requires owner cash visibility. Prefer **add `GET /payments/managed`**: cash/validated payments for leases on managed properties (mirror visits). If too large, ship owner payments as read of schedules via lease schedule endpoint per lease.

  **Decision for implementer:** implement `GET /payments/managed` returning `PublicPayment[]` where payment has allocation to rent schedule on managed property leases — keeps product real.

- [ ] **Step 5: Maintenance list** using existing maintenance endpoints

- [ ] **Step 6: Mandate approvals UI** approve/reject

- [ ] **Step 7: Commit** `feat(web): owner operational pages and managed leases API`

---

### Task 6: Agent portfolio, leases form, maintenance, sales

**Files:**
- Create: `apps/web/lib/agent/portfolio.ts`, `maintenance.ts`, `sales.ts`
- Create: pages under `agent/portfolio`, `agent/leases`, `agent/maintenance`, `agent/sales`
- Modify: `apps/web/lib/routes.ts` — add `agent.sales`, `AGENT_NAV` entry « Demandes vente »
- Reuse: `lib/agent/leases.ts` (`createLease`)

**Interfaces:**
- Portfolio: `GET /properties?organizationId=org_paradis_immo` or properties user can manage
- Sales: `GET /sales/inquiries/managed`, `PATCH /sales/inquiries/:id/status`
- Lease form: fields from `CreateLeaseInput`

- [ ] **Step 1: Portfolio ListDataTable**

- [ ] **Step 2: Lease create form** — propertyId, tenantId (UUID inputs or selects), dates, rent, deposit, currency; on success show id + mandate message

- [ ] **Step 3: Maintenance table**

- [ ] **Step 4: Sales inquiries table + status actions**

- [ ] **Step 5: Commit** `feat(web): agent portfolio, leases, maintenance, sales`

---

### Task 7: API `GET /bookings/managed` + short-stay lists

**Files:**
- Modify: `apps/api/src/bookings/bookings.service.ts`, `bookings.controller.ts`, specs
- Create: `apps/web/lib/bookings.ts`
- Add section or page: owner + agent « Réservations » — either new routes `/owner/bookings`, `/agent/bookings` **or** tabs on properties detail for RENT_SHORT

**Recommendation:** add nav items only if mode is used; minimum is list page under owner and agent:

- `ROUTES.owner.bookings = '/owner/bookings'`
- `ROUTES.agent.bookings = '/agent/bookings'`

- [ ] **Step 1: API listManaged bookings** (property owner or org member)

- [ ] **Step 2: Web list pages** with status + cancel if API allows agent/owner cancel

- [ ] **Step 3: Commit** `feat: managed short-stay bookings for dashboards`

---

### Task 8: Admin moderation + minimal config

**Files:**
- Create: `apps/web/lib/admin/properties.ts`
- Create: `apps/web/app/admin/moderation/admin-moderation.tsx`
- Modify: `apps/web/app/admin/moderation/page.tsx`
- Modify: `apps/web/app/admin/config/page.tsx`

- [ ] **Step 1: `listProperties` + `moderateProperty(id, status)`**

- [ ] **Step 2: Moderation table** — actions Activer / Pause / Archiver with confirm

- [ ] **Step 3: Config page** — show `NEXT_PUBLIC_APP_STORE_URL` and `NEXT_PUBLIC_PLAY_STORE_URL` (read-only), short help text in French

- [ ] **Step 4: Commit** `feat(web): admin moderation and config display`

---

### Task 9: Role switcher + role-aware proxy

**Files:**
- Create: `apps/web/components/dashboard/role-switcher.tsx`
- Create: `apps/web/lib/me.ts` — `getMe()`, `listMyOrganizations()`
- Modify: `apps/web/components/dashboard/topbar.tsx`
- Modify: `apps/web/proxy.ts`
- Modify: `apps/web/lib/active-role.ts` if needed

**Interfaces:**
- Eligible roles: `PLATFORM_ADMIN` → admin; org `AGENT` → agent; else owner
- `setActiveRole` + `router.push(\`/${role}/dashboard\`)`

- [ ] **Step 1: Resolve eligible roles from session + `/users/me/organizations`**

- [ ] **Step 2: RoleSwitcher in topbar** when `eligible.length > 1`

- [ ] **Step 3: proxy.ts** — if path starts with `/admin` and `!roles.includes('PLATFORM_ADMIN')` → redirect `/owner/dashboard`

- [ ] **Step 4: Manual** — non-admin cannot open `/admin/users`

- [ ] **Step 5: Commit** `feat(web): role switcher and admin route guard`

---

### Task 10: Landing live listings + app CTA

**Files:**
- Create: `apps/web/lib/public/properties.ts` — anonymous `apiFetch` list
- Modify: `apps/web/components/landing/landing-properties.tsx`
- Modify: `apps/web/app/landing.css` only if needed
- Modify: `apps/web/.env.example` — store URLs

- [ ] **Step 1: Fetch** `GET /properties?status=ACTIVE&limit=6` (anonymous)

- [ ] **Step 2: Map to cards** — use first media URL if API returns media; else placeholder image from `/landing/house1.jpg`

- [ ] **Step 3: Click handler** — dialog or inline panel: « Disponible sur l’application Paradis Immo » + App Store / Play buttons

- [ ] **Step 4: Commit** `feat(web): landing shows live properties and app download CTA`

---

### Task 11: Seed enrichment + README smoke checklist

**Files:**
- Modify: `apps/api/prisma/seed.ts` — optional second property SALE + RENT_SHORT for demo
- Modify: `README.md` — smoke checklist from design spec
- Modify: `docs/superpowers/plans/2026-07-04-web-mvp-completion.md` — mark superseded by this plan

- [ ] **Step 1: Seed** at least one ACTIVE property with image URL if possible (or skip image in seed)

- [ ] **Step 2: Document** env R2 + store URLs + smoke flows

- [ ] **Step 3: Commit** `docs: web MVP product smoke checklist`

---

### Task 12: Final verification

- [ ] **Step 1: Run** `pnpm --filter api test` and `pnpm --filter web build`

- [ ] **Step 2: Manual smoke** all 9 flows from design spec § Test plan

- [ ] **Step 3: Confirm** zero `PlaceholderSection` on in-scope nav routes (grep)

```bash
rg "PlaceholderSection" apps/web/app/owner apps/web/app/agent apps/web/app/admin
```

Expected: only `admin/config` allowed as minimal non-placeholder page (no PlaceholderSection).

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| properties/mine | 1–2 |
| Media upload | 3 |
| Visit slots | 4 |
| Owner ops pages | 5 |
| Agent ops + sales | 6 |
| Bookings managed | 7 |
| Admin moderation | 8 |
| Role switcher + guards | 9 |
| Landing teaser | 10 |
| Docs/seed | 11–12 |

## Out of scope reminder

Mobile, public payment web, advanced admin config, Docker/E2E (unless scheduled after this plan).
