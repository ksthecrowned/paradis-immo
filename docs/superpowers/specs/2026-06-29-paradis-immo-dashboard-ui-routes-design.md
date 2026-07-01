# Paradis Immo — Dashboard UI & Routes (Revision)

**Date:** 2026-06-29  
**Status:** Approved  
**Parent spec:** `docs/superpowers/specs/2026-06-27-paradis-immo-design.md`  
**Visual reference:** [Darkone — StackBros](https://stackbros.in/darkone/index.html)

---

## 1. Goals

1. **MVP visually complete** — dashboards owner, agent, and admin must look production-ready, not placeholder-grade.
2. **Darkone-inspired dark admin** — recreate the visual language of Darkone using **Tailwind v4 + Preline** (no Bootstrap in the bundle).
3. **English URL paths** — prepare i18n; UI labels remain French at launch.
4. **Shared shell** — one dashboard layout system reused across roles.

---

## 2. Approach

**Hybrid: shared shell + Preline blocks + Darkone design tokens**

- Darkone HTML/CSS is a **visual reference only** (Bootstrap is not imported).
- Extract colors, spacing, typography, and layout patterns from Darkone.
- Build a `DashboardShell` React component (sidebar, topbar, breadcrumb slot, content area).
- Fill pages with Preline components (cards, tables, dropdowns, modals, forms).
- Use **ApexCharts** for dashboard charts (same library family as Darkone demos).

If Darkone source files are purchased later, use them only to refine tokens and assets (icons, illustrations) — still implement in Preline/Tailwind.

---

## 3. Design tokens

Defined in `apps/web/app/globals.css` under `@theme` and `:root` (dashboard scope).

| Token | Purpose | Initial value (tune against Darkone) |
|---|---|---|
| `--dash-bg` | Page background | `#0f111a` |
| `--dash-sidebar` | Sidebar background | `#1a1d2e` |
| `--dash-card` | Card / panel background | `#22263a` |
| `--dash-border` | Borders, dividers | `#2d3348` |
| `--dash-text` | Primary text | `#e8eaed` |
| `--dash-text-muted` | Secondary text | `#9aa0b4` |
| `--dash-accent` | Primary accent (CTA, active nav) | `#6c5ce7` |
| `--dash-success` | Paid, validated | `#00b894` |
| `--dash-warning` | Pending, due soon | `#fdcb6e` |
| `--dash-danger` | Overdue, failed | `#e17055` |

**Typography:** `Inter` (or Geist if already wired) — sans-serif, 14px base in tables, 16px body.

**Radius:** cards `0.75rem`, buttons `0.5rem` (align with Preline defaults where possible).

**Icons:** [Lucide React](https://lucide.dev) for nav and actions (lighter than vendoring Boxicons/Solar from Darkone). Map icon names to match Darkone nav semantics.

---

## 4. Dashboard shell

### 4.1 Structure

```
┌─────────────────────────────────────────────────────────────┐
│ Sidebar (fixed)  │  Topbar (notifications, profile, role)   │
│ - Logo           ├───────────────────────────────────────────┤
│ - Nav items      │  Breadcrumb                               │
│ - Collapse       ├───────────────────────────────────────────┤
│                  │  Page content (cards, tables, charts)    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Components (files)

| Component | Path | Responsibility |
|---|---|---|
| `DashboardShell` | `apps/web/components/dashboard/shell.tsx` | Layout wrapper, sidebar + topbar |
| `SidebarNav` | `apps/web/components/dashboard/sidebar-nav.tsx` | Role-specific nav items |
| `Topbar` | `apps/web/components/dashboard/topbar.tsx` | Notifications dropdown, user menu, role switcher |
| `Breadcrumb` | `apps/web/components/dashboard/breadcrumb.tsx` | Preline breadcrumb from route metadata |
| `StatCard` | `apps/web/components/dashboard/stat-card.tsx` | Darkone-style KPI card |
| `DataTable` | `apps/web/components/dashboard/data-table.tsx` | Styled table wrapper (Preline table classes) |
| `PageHeader` | `apps/web/components/dashboard/page-header.tsx` | Title + actions row |

### 4.3 Layout variants

MVP uses **Dark Sidenav** only (matches [Darkone default](https://stackbros.in/darkone/index.html)). Light mode and topnav variants are out of scope for MVP.

### 4.4 Role-specific navigation

Labels are **French**; `href` values are **English** (see section 5).

**Owner (`/owner/*`)**

| Label | Path |
|---|---|
| Tableau de bord | `/owner/dashboard` |
| Biens | `/owner/properties` |
| Visites | `/owner/visits` |
| Baux | `/owner/leases` |
| Paiements | `/owner/payments` |
| Maintenance | `/owner/maintenance` |
| Mon mandat | `/owner/mandate` |

**Agent (`/agent/*`)**

| Label | Path |
|---|---|
| Tableau de bord | `/agent/dashboard` |
| Portefeuille | `/agent/portfolio` |
| Visites | `/agent/visits` |
| Baux | `/agent/leases` |
| Validation paiements | `/agent/payments/validation` |
| Maintenance | `/agent/maintenance` |

**Admin (`/admin/*`)**

| Label | Path |
|---|---|
| Tableau de bord | `/admin/dashboard` |
| Utilisateurs | `/admin/users` |
| Modération | `/admin/moderation` |
| Configuration | `/admin/config` |

### 4.5 Topbar features (MVP)

- Notification bell → dropdown list from `GET /notifications/my` (unread count badge)
- User avatar + menu: Mon profil, Déconnexion
- Role switcher (if user has multiple org roles): Owner ↔ Agent ↔ Admin

---

## 5. URL conventions

### 5.1 Rules

- All **route segments** in English, kebab-case.
- **UI copy** in French until i18n layer is added (`next-intl` or similar in v1.1).
- **API paths** unchanged (`/api/v1/...` already English).
- No French slugs in new code; migrate existing `/proprietaire/...` routes.

### 5.2 Full route map

```
/login

/owner/dashboard
/owner/properties
/owner/properties/add
/owner/properties/[id]
/owner/properties/[id]/visit-slots
/owner/visits
/owner/leases
/owner/leases/[id]
/owner/payments
/owner/maintenance
/owner/maintenance/[id]
/owner/mandate

/agent/dashboard
/agent/portfolio
/agent/visits
/agent/leases
/agent/payments/validation
/agent/maintenance

/admin/dashboard
/admin/users
/admin/moderation
/admin/config
```

### 5.3 Redirects (temporary)

During migration, Next.js `redirect()` in `next.config.ts` or route handlers:

| Legacy (remove after migration) | New |
|---|---|
| `/proprietaire/dashboard` | `/owner/dashboard` |
| `/proprietaire/biens` | `/owner/properties` |
| `/proprietaire/biens/nouveau` | `/owner/properties/add` |
| `/proprietaire/biens/:id` | `/owner/properties/:id` |
| `/proprietaire/biens/:id/creneaux` | `/owner/properties/:id/visit-slots` |
| `/proprietaire/visites` | `/owner/visits` |
| `/proprietaire/baux` | `/owner/leases` |
| `/proprietaire/paiements` | `/owner/payments` |
| `/proprietaire/maintenance` | `/owner/maintenance` |
| `/proprietaire/mandat` | `/owner/mandate` |

Redirects kept for **one release cycle**, then removed.

### 5.4 Breadcrumb examples

| Route | Breadcrumb (French labels) |
|---|---|
| `/owner/properties/add` | Tableau de bord → Biens → Ajouter |
| `/owner/properties/abc/visit-slots` | Tableau de bord → Biens → Créneaux de visite |
| `/agent/payments/validation` | Tableau de bord → Validation paiements |

---

## 6. Page patterns (Darkone → Paradis Immo)

### 6.1 Owner dashboard (`/owner/dashboard`)

| Darkone block | Paradis Immo content |
|---|---|
| 4 stat cards | Biens actifs, Baux actifs, Paiements en attente, Demandes de visite |
| Revenue chart | Revenus encaissés (30 j / 6 m / 1 a) — ApexCharts area |
| Sales by category | Répartition des biens par mode (court terme / long terme / vente) — donut |
| Recent transactions | Derniers paiements reçus — table with status badges |
| New accounts table | Dernières demandes de visite — table |

### 6.2 Properties list (`/owner/properties`)

- Data table: photo thumb, titre, mode, statut, prix, quartier, actions (éditer, archiver)
- CTA header: « Ajouter un bien » → `/owner/properties/add`
- Filters: mode, statut, quartier (Preline dropdowns)

### 6.3 Property add (`/owner/properties/add`)

- Multi-section form (Preline cards): infos générales, localisation (cascade city → arrondissement → quartier), mode exclusif, config visite, prix
- Darkone form styling: dark inputs with `@tailwindcss/forms` + custom dash tokens

### 6.4 Agent payment validation (`/agent/payments/validation`)

- Table: locataire, bien, montant, méthode (cash), date, bouton « Valider »
- Stat cards: en attente, validés aujourd'hui

### 6.5 Admin dashboard (`/admin/dashboard`)

- Stat cards from `GET /admin/stats`
- Table: annonces récentes à modérer

### 6.6 Login (`/login`)

- Darkone auth page aesthetic: centered card on dark background, Paradis Immo logo
- Two-step OTP (phone → code) — existing flow, restyled only

---

## 7. Bootstrap → Preline mapping

| Darkone (Bootstrap) | Preline / Tailwind equivalent |
|---|---|
| `.card` | Preline Card + `--dash-card` background |
| `.table` | Preline Table, striped rows optional |
| `.dropdown` | Preline Dropdown (`hs-dropdown`) |
| `.badge` | Preline Badge (status colors from tokens) |
| `.breadcrumb` | Preline Breadcrumb |
| `.offcanvas` | Preline Offcanvas (mobile sidebar) |
| `.modal` | Preline Modal |
| `.form-control` | Tailwind forms + Preline input classes |
| ApexCharts | `react-apexcharts` (same as Darkone) |
| Sidebar collapse | Preline Sidebar + local state / `localStorage` |

**Preline init:** keep `PrelineBoot` client component; shell must call `HSStaticMethods.autoInit()` after route changes if dropdowns break on navigation.

---

## 8. Dependencies (web)

Add to `apps/web/package.json`:

| Package | Purpose |
|---|---|
| `apexcharts` + `react-apexcharts` | Dashboard charts |
| `lucide-react` | Icons |

Do **not** add Bootstrap, jQuery, or Darkone CSS.

---

## 9. i18n preparation

MVP does not ship a translation library. Preparation steps:

1. English URL paths (this spec).
2. All user-visible strings in French as literal copy in components (no hardcoded strings in route paths).
3. v1.1: introduce `next-intl` with `fr` default; paths stay English, locale via cookie/header or `fr` subdomain later.

---

## 10. Quality assurance (no automated frontend tests)

Per `docs/superpowers/specs/2026-06-29-paradis-immo-testing-policy.md`:

- **Visual:** manual checklist against [Darkone reference](https://stackbros.in/darkone/index.html)
- **Build:** `pnpm --filter web build` + lint
- **Smoke:** login OTP, navigation, redirects `/proprietaire/*` → `/owner/*`
- **A11y:** manual check — sidebar keyboard nav, mobile offcanvas focus

---

## 11. Out of scope

- Light mode / theme toggle
- Purchasing or bundling Darkone Bootstrap assets
- Mobile app dashboard (marketplace stays separate design)
- Custom illustration pack from Darkone

---

## 12. Spec self-review

| Check | Result |
|---|---|
| Placeholders | None |
| Consistency with parent spec | API unchanged; web routes supersede section 6.2 of parent |
| Scope | Single implementation track (web shell + route migration) |
| Ambiguity | Dark-only for MVP; redirects temporary one release |

---

## 13. Parent spec amendments

Section **6.2 Web routes** of `2026-06-27-paradis-immo-design.md` is superseded by section 5 of this document.

Add to web stack line: **ApexCharts**, **Lucide**, **Darkone-inspired design tokens**, **DashboardShell**.
