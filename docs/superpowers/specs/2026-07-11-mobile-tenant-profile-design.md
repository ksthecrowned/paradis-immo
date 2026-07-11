# Mobile Tenant Space + Richer Profile — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** UI-first (mocks). Roadmap pass **B + D** (combined).

## Goal

Give authenticated tenant/buyers a real **post-lease home**: list and manage leases (schedule, pay rent, report maintenance), and a **richer Profile** (edit identity, settings, documents) — with two entry points (Profile + Activity → Loyers) sharing one mock data model.

## Roadmap context

| Pass | Topic |
|------|--------|
| A | Official agency hub (done) |
| C | Listing Dispo / Indispo (done) |
| **B + D (this doc)** | Tenant rentals space + richer Profile |

## Non-goals

- Real Nest/Prisma wiring (keep `lib/leases.ts` API helpers unused for now, or wrap mocks behind the same shapes)
- File upload / camera for documents
- Chat with agent, WhatsApp deep automation
- Fifth tab-bar item « Locations »
- Multi-language runtime (only Français active)
- Owner/agent surfaces on mobile

## Decisions

| Topic | Choice |
|-------|--------|
| Pass packaging | Single combined B + D spec + plan |
| Tenant MVP | Leases list + detail + schedule + pay rent + maintenance tickets |
| Profile MVP | Edit identity + menu + settings + documents |
| Navigation IA | Dual entry: Profile « Mes locations » **and** Activity → Loyers → same `/leases/[id]` |
| Screen architecture | Dedicated stacks (Approach A): `/leases…` + `/profile/…` |
| Auth | OTP gate via `ensureAuthenticated` (same as Activity) |
| Pay rent | Reuse `/payment/[id]` with mock session type `RENT` |
| Terminated lease | No pay CTA; no new maintenance ticket (show message if attempted) |

## Architecture & routes

All routes below require auth.

| Route | Role |
|-------|------|
| `/leases` | Lease list |
| `/leases/[id]` | Lease detail: summary + schedule + maintenance |
| `/leases/[id]/maintenance/new` | Create maintenance ticket |
| `/payment/[id]` | Existing payment UI; rent sessions |
| `/profile/edit` | Edit name / optional email |
| `/profile/settings` | Language, theme, push toggle |
| `/profile/documents` | Document list + mock preview |

**Entries**

- Profile menu → Mes locations → `/leases`
- Profile menu → Mes documents / Réglages / Modifier
- Activity segment `rents` → tap → `/leases/[id]` (not property detail)

## Domain (mock)

```ts
type LeaseStatus = 'ACTIVE' | 'TERMINATED';
type RentLineStatus = 'PENDING' | 'PAID' | 'OVERDUE';
type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
type MaintenanceUrgency = 'LOW' | 'NORMAL' | 'HIGH';
type DocumentStatus = 'VALIDATED' | 'PENDING' | 'MISSING';

type MockLease = {
  id: string;
  propertyId: string;
  status: LeaseStatus;
  startDate: string; // ISO date
  endDate?: string;
  monthlyRent: number;
  deposit: number;
  currency: 'FCFA';
  agencyId: string;
  agentId: string;
};

type MockRentScheduleEntry = {
  id: string;
  leaseId: string;
  label: string; // e.g. « Juillet 2026 »
  dueDate: string;
  amount: number;
  status: RentLineStatus;
  paymentSessionId?: string; // when payable
};

type MockMaintenanceTicket = {
  id: string;
  leaseId: string;
  title: string;
  description: string;
  urgency: MaintenanceUrgency;
  status: MaintenanceStatus;
  createdAt: string;
};

type MockTenantDocument = {
  id: string;
  title: string;
  status: DocumentStatus;
  leaseId?: string;
  previewHint: string; // French stub for preview sheet
};
```

**Seed expectations**

- ≥1 `ACTIVE` lease with mix of PAID / PENDING / optionally OVERDUE schedule lines
- ≥1 `TERMINATED` lease (history)
- ≥2 maintenance tickets on the active lease (different statuses)
- Rent payment sessions linked to PENDING (or OVERDUE) lines
- Documents: mix VALIDATED / PENDING / MISSING
- Activity `rents` items derived from schedule (stable ids; same `leaseId`)

**French labels**

| Value | Label |
|-------|--------|
| ACTIVE | Actif |
| TERMINATED | Terminé |
| PENDING (rent) | À payer |
| PAID | Payé |
| OVERDUE | En retard |
| OPEN | Ouvert |
| IN_PROGRESS | En cours |
| RESOLVED | Résolu |
| LOW / NORMAL / HIGH | Basse / Normale / Haute |
| VALIDATED / PENDING / MISSING | Validé / En attente / Manquant |

## UI — Tenant (B)

### `/leases`

- Cards: property cover/title/location, lease status badge, monthly rent, next due line (amount + status)
- Empty: « Aucun bail » + CTA toward Home/Discover
- Pull-to-refresh (mock tick)
- Auth gate

### `/leases/[id]`

Scroll with three sections:

1. **Bail** — property summary (tap → `/property/[id]`), agency/agent, dates, rent, deposit, status
2. **Échéancier** — month rows; primary « Payer » only when `PENDING` or `OVERDUE` → `/payment/[paymentSessionId]`
3. **Maintenance** — ticket rows (title + status); CTA « Signaler un problème » → new ticket route (disabled/hidden on `TERMINATED` with short explanation)

### `/leases/[id]/maintenance/new`

- Fields: title, description, urgency (segmented)
- Submit mock → success feedback → back to detail with new ticket first

### Activity → Loyers

- Keep list chrome; change navigation target to `/leases/[id]`
- Prefer deriving list from mock leases/schedule so Profile and Activity stay consistent

## UI — Profile (D)

### Profile tab (enriched)

- Identity card + **Modifier** → `/profile/edit`
- Menu order:
  1. Mes locations
  2. Mes documents
  3. Mes favoris
  4. Mon activité
  5. Notifications
  6. Réglages
  7. Aide & support (existing info feedback)
- Logout (existing)

### `/profile/edit`

- Name (required), email (optional), phone read-only (OTP-bound)
- Save updates local `AuthUser` + success feedback + back

### `/profile/settings`

- Language: Français selected; other options disabled « Bientôt »
- Theme: Système / Clair / Sombre — persist locally; apply via existing theme mechanism when available, else feedback stub
- Push notifications: boolean switch, persist locally

### `/profile/documents`

- List with status badges
- Tap → mock preview (sheet or simple screen with `previewHint`)
- « Ajouter » → feedback « Bientôt » (no upload)

## Visual / product constraints

- French copy only
- Brand `#7065F0`, existing theme tokens, StatusBadge / SegmentTabs patterns
- No new tab bar item

## Acceptance (smoke)

1. Profile → Mes locations → lease detail → Payer → mock payment success
2. Signaler un problème → ticket appears on lease detail
3. Activity → Loyers → same lease detail
4. Edit name; toggle push; open a document preview
5. Terminated lease: no pay / no new ticket
6. Logged-out user hitting `/leases` is sent through OTP gate

## Out of scope follow-ups

- Wire mocks to `GET /leases/my` + schedule API
- Real document upload and receipt PDF viewer
- Maintenance messaging thread with agent
- Full i18n / dark-mode polish if theme stack is incomplete
