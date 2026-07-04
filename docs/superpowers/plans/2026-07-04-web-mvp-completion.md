# Web MVP Completion — Implementation Plan

> **Superseded (2026-07-04):** Use **`docs/superpowers/plans/2026-07-04-web-mvp-product-plan.md`** and spec **`docs/superpowers/specs/2026-07-04-web-mvp-product-design.md`** (product-grade web MVP, all modes, media, landing teaser). This file remains as historical snapshot of the earlier W1–W10 outline.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the Paradis Immo web dashboards (owner / agent / admin) and auth gates so every sidebar route is functional against the existing Nest API, then hand off to mobile and E2E.

**Architecture:** Next.js App Router client pages call `apiFetch` / `apiFetchPaginated` against `apps/api`. Shared UI lives in `apps/web/components/dashboard` (`ListDataTable`, `PaginatedDataTable`, `DashboardPageHeader`, Darkone tokens). Role surfaces use English paths (`/owner`, `/agent`, `/admin`) with French labels. Landing (`/`) is Estatery-styled marketing; dashboards stay Darkone dark/light.

**Tech Stack:** Next.js 16, Tailwind v4, Preline, Iconify Solar, NestJS + Prisma, JWT OTP auth.

**Parent plans:** `docs/superpowers/plans/2026-06-27-paradis-immo-mvp.md` (Tasks 25–34), `docs/superpowers/plans/2026-06-29-paradis-immo-dashboard-ui-routes.md` (D1–D6 done).

## Global Constraints

- Paths English only (`/owner/*`, `/agent/*`, `/admin/*`); UI copy French.
- Reuse `ListDataTable` / `PaginatedDataTable` for list pages (Preline-style, project tokens).
- No new shared packages; types live in `apps/web/lib/*` and OpenAPI-generated `apps/web/types/api.ts` when regenerated.
- Prefer existing endpoints; add API only when a list/action is impossible (document in the task).
- Seed accounts: `+242060000001` admin, `+242060000002` agent, `+242060000003` owner (see root `README.md`).
- Do not commit secrets; do not amend commits unless asked.

---

## Status snapshot (2026-07-04)

### Done

| Area | Delivered |
|------|-----------|
| API (Tasks 1–23) | Auth OTP, properties, visits, leases, payments, mandates, maintenance, admin stats/users/moderate |
| Shell UI (D1–D5) | Darkone shell, tokens, Iconify, Poppins, dark/light theme |
| Task 24 | Login OTP, `apiFetch`, Preline boot |
| Task 25 (reduced) | Owner dashboard wired to `/payments/my` + `/visits/managed`; other owner routes placeholders |
| Task 26 partial | `GET /payments/pending-validation`, agent payments validation page, agent visits confirm/cancel |
| Task 27 partial | Admin stats from `GET /admin/stats`, users `PaginatedDataTable` on `GET /admin/users` |
| Landing | Estatery-style `/` with kit assets under `public/landing/` |
| DX | Seed test users, root `README.md` |

### Still placeholders (web)

- **Owner:** properties list/add/detail/visit-slots, visits, leases, payments, maintenance, mandate  
- **Agent:** portfolio, leases (form), maintenance  
- **Admin:** moderation, config  

### Not started (later phases)

- Mobile Tasks 28–31  
- Task 32 auth/RBAC gates (partial helpers exist: `lib/active-role.ts`)  
- Tasks 33–34 E2E + Docker  

---

## File map (remaining web work)

| Path | Responsibility |
|------|----------------|
| `apps/web/lib/admin/properties.ts` | List + moderate properties for admin |
| `apps/web/lib/owner/properties.ts` | Owner property CRUD helpers |
| `apps/web/lib/owner/mandates.ts` | Pending approvals list + approve/reject |
| `apps/web/lib/agent/portfolio.ts` | Mandated / managed properties for agent |
| `apps/web/components/dashboard/role-switcher.tsx` | Multi-role header control |
| `apps/web/components/auth/require-auth.tsx` | Client gate: token + optional roles |
| `apps/web/app/admin/moderation/*` | Moderation UI |
| `apps/web/app/agent/leases/*` | Lease create form |
| `apps/web/app/agent/portfolio/*` | Portfolio list |
| `apps/web/app/owner/properties/*` | Property list / add / detail / visit-slots |
| `apps/web/app/owner/mandate/*` | Mandate approvals |
| `apps/web/app/owner/visits|leases|payments|maintenance/*` | List pages on existing APIs |

---

### Task W1: Admin moderation page

**Goal:** PLATFORM_ADMIN can list properties and set status `ACTIVE` | `PAUSED` | `ARCHIVED`.

**API (exists):**
- `GET /properties?status=&limit=&offset=` → `{ data, meta }` (public list; admin uses it with auth optional)
- `PATCH /admin/properties/:id/moderate` body `{ status, reason? }`

**Files:**
- Create: `apps/web/lib/admin/properties.ts`
- Create: `apps/web/app/admin/moderation/admin-moderation.tsx`
- Modify: `apps/web/app/admin/moderation/page.tsx`

**Note:** `apiFetch` unwraps `{ statusCode, data }` and drops `meta` for properties list. Use a dedicated helper (same pattern as `apiFetchPaginated`) that returns `{ data, meta }` for `GET /properties`, or call `fetch` via a small `apiFetchList` if meta shape differs (`limit`/`offset` vs `page`/`pageSize`).

- [ ] **Step 1:** Add `listPropertiesForAdmin({ status?, limit, offset })` and `moderateProperty(id, status)` in `lib/admin/properties.ts`

- [ ] **Step 2:** Build `AdminModeration` with `ListDataTable` (or client pagination): columns title, mode, status, price, owner; actions Pause / Activate / Archive with confirm

- [ ] **Step 3:** Wire `page.tsx`, loading/error states, auth redirect if no token

- [ ] **Step 4:** Manual test as `+242060000001` on `/admin/moderation` (seed has `prop_test_demo` ACTIVE)

- [ ] **Step 5:** Commit

---

### Task W2: Role switcher in topbar (Task 27 Step 3)

**Goal:** Multi-role users switch dashboard surface without re-login.

**Exists:** `apps/web/lib/active-role.ts` (`resolveActiveRole`, `setActiveRole`) — **not wired** in UI.

**Files:**
- Create: `apps/web/components/dashboard/role-switcher.tsx`
- Modify: `apps/web/components/dashboard/topbar.tsx`
- Modify: `apps/web/components/dashboard/shell.tsx` (derive `role` from active role when possible)
- Modify: `apps/web/app/login/page.tsx` (already redirects by phone/roles; keep consistent with `resolveActiveRole`)
- Modify: `apps/web/lib/auth.ts` if needed to expose `user.roles` from `/users/me`

**Mapping:**
- `PLATFORM_ADMIN` → `admin`
- Org member `AGENT` → `agent` (needs `GET /users/me/organizations`)
- Default / owner org → `owner`

- [ ] **Step 1:** Add `getMe()` + `listMyOrganizations()` helpers; on shell mount, compute eligible roles and `resolveActiveRole`

- [ ] **Step 2:** `RoleSwitcher` dropdown in topbar (only if `eligible.length > 1`); on change call `setActiveRole` + `router.push(\`/${role}/dashboard\`)`

- [ ] **Step 3:** Shell reads active role for nav (`OWNER_NAV` / `AGENT_NAV` / `ADMIN_NAV`) instead of hard-coded layout prop only — layouts may still pass default role, switcher overrides via context or pathname

- [ ] **Step 4:** Manual test: grant admin user an org AGENT membership in DB, login, switch admin ↔ agent

- [ ] **Step 5:** Commit

---

### Task W3: Agent lease create form (Task 26 Step 3)

**Goal:** Agent creates a lease; if property is mandated, API returns mandate approval flow (existing backend).

**API (exists):**
- `POST /leases` body: `propertyId`, `tenantId`, `startDate`, `endDate`, `monthlyRent`, `deposit`, `currency`
- `PATCH /leases/:id/activate`
- Client helpers already in `apps/web/lib/agent/leases.ts`

**Files:**
- Create: `apps/web/app/agent/leases/agent-leases.tsx` (form + success/error)
- Modify: `apps/web/app/agent/leases/page.tsx`
- Optional: `apps/web/lib/agent/portfolio.ts` to populate property select from managed properties

**Gap:** No `GET /leases` list for agent. MVP form-only is enough; list can show “created lease id” after submit. If portfolio endpoint missing, use free-text `propertyId` / `tenantId` UUIDs for MVP (document in UI).

- [ ] **Step 1:** Form fields matching `CreateLeaseInput`, French labels, validation (dates, positive amounts)

- [ ] **Step 2:** On success show lease id + status; if response includes `mandateApprovalId`, show message “En attente d’approbation propriétaire”

- [ ] **Step 3:** Optional activate button calling `activateLease` when status allows

- [ ] **Step 4:** Manual test with seed property `prop_test_demo` and tenant `user_test_tenant`

- [ ] **Step 5:** Commit

---

### Task W4: Agent portfolio + maintenance lists

**Goal:** Replace agent portfolio and maintenance placeholders.

**API:**
- Portfolio: properties where user is org member — prefer filtering `GET /properties?organizationId=org_paradis_immo` for agent of Paradis Immo; or add `GET /properties/managed` only if filter insufficient
- Maintenance: `GET /maintenance/tickets` (managed) — verify controller in `apps/api/src/maintenance`

**Files:**
- Create: `apps/web/lib/agent/portfolio.ts`, `apps/web/lib/agent/maintenance.ts`
- Create: `apps/web/app/agent/portfolio/agent-portfolio.tsx`
- Create: `apps/web/app/agent/maintenance/agent-maintenance.tsx`
- Modify: corresponding `page.tsx`

- [ ] **Step 1:** Confirm maintenance list endpoint shape in OpenAPI / controller; add thin client helpers

- [ ] **Step 2:** Portfolio `ListDataTable` (title, status, mode, price)

- [ ] **Step 3:** Maintenance tickets table (status, property, reporter, actions if assign exists)

- [ ] **Step 4:** Manual test as agent seed user

- [ ] **Step 5:** Commit

---

### Task W5: Owner properties (list + create)

**Goal:** Owner can list own properties and create a new listing.

**API (exists):**
- `POST /properties` (creates owner org automatically)
- `GET /properties` — **no owner filter**. Options: (A) add `GET /properties/mine` in API, or (B) filter client-side by `ownerId` from `GET /users/me` if list returns ownerId (it does on `PublicProperty`).

**Preferred:** Add `GET /properties/mine` in API (auth required, `where: { ownerId: userId }`) — small, correct, avoids leaking other owners’ drafts.

**Files:**
- API: `apps/api/src/properties/properties.service.ts`, `properties.controller.ts`, test in `properties.spec.ts`
- Web: `apps/web/lib/owner/properties.ts`
- Web: `apps/web/app/owner/properties/owner-properties.tsx`, `owner-property-form.tsx`
- Modify: `apps/web/app/owner/properties/page.tsx`, `add/page.tsx`

- [ ] **Step 1:** API `GET /properties/mine` + unit/integration test

- [ ] **Step 2:** Owner list page with `ListDataTable` + link to add

- [ ] **Step 3:** Create form (title, description, type, mode, price, currency, priceUnit, quartierId, address, visit fields optional) — quartier: load `GET /locations/quartiers?cityId=` or hardcode seed quartier for MVP with note

- [ ] **Step 4:** Manual test as owner seed; dashboard property count can later use `/properties/mine`

- [ ] **Step 5:** Commit

---

### Task W6: Owner property detail + visit slots

**Goal:** View property; manage visit templates / block slots.

**API (exists):**
- `GET /properties/:id`
- `GET|POST /properties/:id/visit-templates`
- `POST /properties/:id/visit-slots/block`
- `GET /properties/:id/visit-slots`

**Files:**
- `apps/web/lib/owner/visit-slots.ts`
- `apps/web/app/owner/properties/[id]/owner-property-detail.tsx`
- `apps/web/app/owner/properties/[id]/visit-slots/owner-visit-slots.tsx`
- Modify: `page.tsx` files under `[id]`

- [ ] **Step 1:** Detail page: title, status, price, address, link to visit-slots

- [ ] **Step 2:** Visit slots page: list templates, form create template (dayOfWeek, startTime, endTime, slotMinutes), list upcoming slots

- [ ] **Step 3:** Manual test

- [ ] **Step 4:** Commit

---

### Task W7: Owner visits, payments, leases, maintenance, mandate

**Goal:** Wire remaining owner nav items to existing APIs with `ListDataTable`.

| Page | API |
|------|-----|
| Visits | `GET /visits/managed` (already used on dashboard) |
| Payments | `GET /payments/my` |
| Leases | **Gap:** no owner lease list — add `GET /leases/managed` or show empty + link to agent; prefer API list by property ownership |
| Maintenance | `GET /maintenance/tickets` / `my` per controller |
| Mandate | `GET /mandates/pending-approvals`, `PATCH /mandates/approvals/:id` |

**Files:**
- `apps/web/lib/owner/*.ts` as needed
- Replace placeholders under `apps/web/app/owner/{visits,payments,leases,maintenance,mandate}/`

- [ ] **Step 1:** Visits list (reuse agent visits patterns; owner may confirm/cancel same endpoints)

- [ ] **Step 2:** Payments list with status badges

- [ ] **Step 3:** Mandate approvals: list pending, approve/reject buttons

- [ ] **Step 4:** Maintenance list for owner-managed properties

- [ ] **Step 5:** Leases — if no API, implement `GET /leases/managed` in API (properties owned or org-managed), then table

- [ ] **Step 6:** Manual smoke all owner nav links

- [ ] **Step 7:** Commit

---

### Task W8: Auth gate + route guards (Task 32 web only)

**Done (2026-07-04):** NextAuth v5 + refreshToken in session JWT, `proxy.ts` protects `/owner|/agent|/admin`, `useRequireSession` on key pages.

**Remaining:** role-based redirects (admin-only routes for non-admins).

**Files:**
- Exists: `apps/web/auth.ts`, `proxy.ts`, `hooks/use-require-session.ts`
- Modify: `proxy.ts` — check `req.auth.user.roles` for `/admin` → `PLATFORM_ADMIN`

- [x] **Step 1:** NextAuth OTP credentials + JWT refresh callback
- [x] **Step 2:** Proxy session gate (any authenticated user)
- [ ] **Step 3:** Role-specific proxy rules (admin / agent)
- [ ] **Step 4:** Commit role rules

---

### Task W9: Admin config placeholder decision

**Goal:** Either minimal config page (read-only platform org info) or keep placeholder with clear copy.

- [ ] **Step 1:** If no API, leave `PlaceholderSection` with `apiReady={false}` and French description — no fake forms

- [ ] **Step 2:** Commit only if copy/docs change

---

### Task W10: Landing fidelity pass (optional, non-blocking)

**Goal:** Pixel-closer Estatery if product prioritizes marketing.

- [ ] **Step 1:** Side-by-side Figma node `601:1294` vs `/` — adjust spacing, type scale, hero card positions

- [ ] **Step 2:** Commit

---

## Execution order

```
W1 Admin moderation
W2 Role switcher
W3 Agent lease form
W4 Agent portfolio + maintenance
W5 Owner properties list/create (+ GET /properties/mine)
W6 Owner detail + visit slots
W7 Owner visits/payments/mandate/maintenance/leases
W8 Auth gates
W9 Admin config (minimal)
W10 Landing polish (optional)
```

Then resume parent plan **Phase 12 Mobile (28–31)** and **Phase 13 (32 mobile, 33 E2E, 34 Docker)**.

---

## API additions checklist (only if required)

| Endpoint | Task | Reason |
|----------|------|--------|
| `GET /properties/mine` | W5 | Owner list without scanning public catalog |
| `GET /leases/managed` | W7 | Owner/agent lease list |
| `GET /properties/managed` | W4 | Only if `organizationId` filter insufficient |

Each addition: service method + controller route + one Jest test + regenerate OpenAPI (`pnpm export:openapi` + `pnpm generate:types`) if types are used.

---

## Verification (every task)

```bash
pnpm --filter web build
pnpm --filter api test   # when API changes
```

Manual: seed accounts from root `README.md`, OTP in API logs.

---

## Out of scope for this plan

- Mobile Expo screens (Tasks 28–31)
- Full E2E suite (Task 33)
- Production Docker (Task 34)
- Infobip / FCM production config
- Marketplace public browse UI on web (mobile-first in parent plan)
