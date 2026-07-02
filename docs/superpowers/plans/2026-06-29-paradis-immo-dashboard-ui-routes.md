# Paradis Immo — Dashboard UI & Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate web dashboards to a Darkone-inspired dark admin shell (Tailwind + Preline), and rename all dashboard routes to English paths.

**Architecture:** Shared `DashboardShell` component with design tokens in `globals.css`; Preline for interactive UI; ApexCharts for graphs; Lucide for icons. No Bootstrap.

**Tech Stack:** Next.js App Router, Tailwind v4, Preline 4.x, ApexCharts, Lucide React, native `fetch`.

**Spec reference:** `docs/superpowers/specs/2026-06-29-paradis-immo-dashboard-ui-routes-design.md`

## Global Constraints

- No Bootstrap, jQuery, or Darkone CSS in the bundle — visual reference only
- URL paths in English; UI labels in French
- Native `fetch` only (no TanStack Query, no Zustand)
- **No automated tests in web or mobile** — API only (see `docs/superpowers/specs/2026-06-29-paradis-immo-testing-policy.md`)
- Preline + Tailwind v4 (`@source` in globals.css, not tailwind.config.js)
- Dark theme only for dashboards at MVP
- Legacy `/proprietaire/*` → `/owner/*` redirects for one release cycle

---

## File Structure (new / moved)

```
apps/web/
├── app/
│   ├── login/page.tsx                    # restyle Darkone auth
│   ├── owner/                            # replaces proprietaire/
│   │   ├── layout.tsx                    # wraps DashboardShell
│   │   ├── dashboard/page.tsx
│   │   ├── properties/
│   │   │   ├── page.tsx
│   │   │   ├── add/page.tsx
│   │   │   └── [id]/
│   │   │       ├── page.tsx
│   │   │       └── visit-slots/page.tsx
│   │   ├── visits/page.tsx
│   │   ├── leases/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── maintenance/page.tsx
│   │   └── mandate/page.tsx
│   ├── agent/                            # English paths only
│   └── admin/
├── components/dashboard/
│   ├── shell.tsx
│   ├── sidebar-nav.tsx
│   ├── topbar.tsx
│   ├── breadcrumb.tsx
│   ├── stat-card.tsx
│   ├── data-table.tsx
│   └── page-header.tsx
└── lib/routes.ts                         # path constants + nav config
```

---

### Task D1: Design tokens + global dark dashboard styles

**Files:**
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/lib/routes.ts`

**Interfaces:**
- Produces: CSS variables `--dash-*` usable as Tailwind arbitrary values or `@theme` entries
- Produces: `OWNER_NAV`, `AGENT_NAV`, `ADMIN_NAV` arrays `{ href, label }`

- [x] **Step 1: Add design tokens to globals.css**

```css
:root {
  --dash-bg: #0f111a;
  --dash-sidebar: #1a1d2e;
  --dash-card: #22263a;
  --dash-border: #2d3348;
  --dash-text: #e8eaed;
  --dash-text-muted: #9aa0b4;
  --dash-accent: #6c5ce7;
  --dash-success: #00b894;
  --dash-warning: #fdcb6e;
  --dash-danger: #e17055;
}
```

- [ ] **Step 2: Create routes.ts with English path constants**

```typescript
export const ROUTES = {
  owner: {
    dashboard: '/owner/dashboard',
    properties: '/owner/properties',
    propertiesAdd: '/owner/properties/add',
    property: (id: string) => `/owner/properties/${id}`,
    visitSlots: (id: string) => `/owner/properties/${id}/visit-slots`,
    visits: '/owner/visits',
    leases: '/owner/leases',
    payments: '/owner/payments',
    maintenance: '/owner/maintenance',
    mandate: '/owner/mandate',
  },
  agent: { /* ... */ },
  admin: { /* ... */ },
  login: '/login',
} as const;
```

- [ ] **Step 3: Verify `pnpm --filter web build` passes**

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/globals.css apps/web/lib/routes.ts
git commit -m "feat(web): add Darkone design tokens and English route constants"
```

---

### Task D2: DashboardShell components

**Files:**
- Create: `apps/web/components/dashboard/shell.tsx`
- Create: `apps/web/components/dashboard/sidebar-nav.tsx`
- Create: `apps/web/components/dashboard/topbar.tsx`
- Create: `apps/web/components/dashboard/breadcrumb.tsx`
- Create: `apps/web/components/dashboard/stat-card.tsx`
- Create: `apps/web/components/dashboard/page-header.tsx`

**Interfaces:**
- Produces: `DashboardShell({ role, children, breadcrumb })` — dark sidebar layout matching Darkone sidenav
- Produces: `StatCard({ label, value, hint?, trend? })`

- [x] **Step 1: Install deps**

```bash
cd apps/web && pnpm add apexcharts react-apexcharts lucide-react
```

- [x] **Step 2: Implement StatCard, PageHeader, Breadcrumb**

- [x] **Step 3: Implement SidebarNav using Preline sidebar markup + `OWNER_NAV` from routes.ts**

- [x] **Step 4: Implement Topbar with notification bell placeholder + logout**

- [x] **Step 5: Implement DashboardShell composing sidebar + topbar + main content area**

- [x] **Step 6: Run `pnpm --filter web build` — PASS**

- [x] **Step 7: Commit**

---

### Task D3: Migrate `/proprietaire` → `/owner` routes

**Files:**
- Move: `apps/web/app/proprietaire/**` → `apps/web/app/owner/**`
- Modify: `apps/web/next.config.ts` — add redirects
- Modify: all internal links in owner pages, `owner-dashboard.tsx`

**Interfaces:**
- Consumes: `ROUTES` from `lib/routes.ts`

- [ ] **Step 1: Move directory `app/proprietaire` → `app/owner`**

- [ ] **Step 2: Rename subroutes**

| Old | New |
|---|---|
| `biens` | `properties` |
| `biens/nouveau` | `properties/add` |
| `biens/[id]/creneaux` | `properties/[id]/visit-slots` |
| `visites` | `visits` |
| `baux` | `leases` |
| `paiements` | `payments` |
| `mandat` | `mandate` |

- [ ] **Step 3: Add redirects in next.config.ts**

```typescript
async redirects() {
  return [
    { source: '/proprietaire/:path*', destination: '/owner/:path*', permanent: false },
    { source: '/owner/biens/:path*', destination: '/owner/properties/:path*', permanent: false },
    { source: '/owner/properties/nouveau', destination: '/owner/properties/add', permanent: false },
    { source: '/owner/properties/:id/creneaux', destination: '/owner/properties/:id/visit-slots', permanent: false },
    { source: '/owner/visites', destination: '/owner/visits', permanent: false },
    { source: '/owner/baux', destination: '/owner/leases', permanent: false },
    { source: '/owner/paiements', destination: '/owner/payments', permanent: false },
    { source: '/owner/mandat', destination: '/owner/mandate', permanent: false },
  ];
}
```

- [ ] **Step 4: Update internal links in `owner-dashboard.tsx` to `ROUTES.owner.*`**

- [ ] **Step 5: Delete empty `app/proprietaire` if redirects cover legacy paths only**

- [ ] **Step 6: Run `pnpm --filter web build` — PASS**

- [ ] **Step 7: Commit**

---

### Task D4: Wire owner layout to DashboardShell

**Files:**
- Modify: `apps/web/app/owner/layout.tsx`
- Modify: `apps/web/app/owner/dashboard/owner-dashboard.tsx`
- Modify: `apps/web/app/owner/dashboard/page.tsx`

- [ ] **Step 1: Replace custom sidebar in owner layout with `<DashboardShell role="owner">`**

- [ ] **Step 2: Restyle OwnerDashboard stat cards using `<StatCard>`**

- [ ] **Step 3: Add ApexCharts revenue placeholder chart on dashboard (static data OK for MVP shell)**

- [ ] **Step 4: Restyle login page (`/login`) — centered dark card like Darkone auth**

- [ ] **Step 5: Run `pnpm --filter web build` — PASS**

- [ ] **Step 6: Commit**

---

### Task D5: Agent + admin shells (before feature pages)

**Files:**
- Create: `apps/web/app/agent/layout.tsx` (if missing)
- Create: `apps/web/app/admin/layout.tsx` (if missing)
- Create: placeholder pages under `/agent/*` and `/admin/*` with DashboardShell

**Note:** Use English paths from day one (`/agent/portfolio`, `/admin/users`).

- [ ] **Step 1: Agent layout + nav using `AGENT_NAV`**

- [ ] **Step 2: Admin layout + nav using `ADMIN_NAV`**

- [ ] **Step 3: Placeholder pages with PageHeader + "Bientôt disponible"**

- [ ] **Step 4: Commit**

---

### Task D6: Update parent MVP plan cross-references

**Files:**
- Modify: `docs/superpowers/plans/2026-06-27-paradis-immo-mvp.md` — note Tasks 26–27 use `/agent` and `/admin` English paths + DashboardShell

- [ ] **Step 1: Add amendment note at top of Phase 11 in parent plan**

- [ ] **Step 2: Commit docs**

---

## Execution order

Run **D1 → D2 → D3 → D4 → D5 → D6** before continuing Task 26 (agent feature pages) and Task 27 (admin feature pages) from the parent plan.

## Manual visual checklist

- [ ] Sidebar matches Darkone dark sidenav density and colors
- [ ] Stat cards have icon, value, label, optional trend
- [ ] Tables use dark row hover
- [ ] Dropdowns (profile, notifications) open via Preline
- [ ] `/proprietaire/dashboard` redirects to `/owner/dashboard`
- [ ] All nav labels French, all hrefs English
