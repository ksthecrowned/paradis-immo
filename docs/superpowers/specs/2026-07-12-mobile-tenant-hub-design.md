# Mobile Tenant Hub (Locations) — Design Spec

**Date:** 2026-07-12  
**Status:** Approved in brainstorming  
**Scope:** Mobile UI — replace Activité in the tab bar with a **Locations** tenant hub (pay rent first, prospect pipeline when no lease). Activity becomes a secondary historique screen. UI-first on existing mocks.

**Inspired by:** [TenantApp](https://www.tenantapp.com/) (rent pay / tenant home)  
**Explicitly not:** [Immofacile / Orisha](https://realestate.orisha.com/nos-solutions/immofacile/) (B2B transaction CRM)

## Goal

Give authenticated users a dedicated **Locations** tab that feels like a tenant home: next rent + **Payer**, bail shortcuts, maintenance — or, when they have no active lease, a **prospect hub** (upcoming visits + in-progress requests). Move the generic Activity feed out of the bottom bar.

## Positioning vs Immofacile

| Immofacile | Paradis Immo (this pass) |
|------------|--------------------------|
| Software for agencies / mandataires | Marketplace + light property management for Congo |
| Transaction CRM (pige, mandats, multidiffusion, Scout IA…) | Consumer mobile: discovery + tenant/buyer journeys |
| Pro field app | Locations tab = **occupant** experience (TenantApp-like) |

Immofacile-style agent tooling (rapprochements, relances, GED, social) remains a **future web/agent** topic — out of scope here. Documented also in `resources/figma-design.md` as a similar *agency* solution, not a tenant UX template.

## Decisions

| Topic | Choice |
|-------|--------|
| Priority | Hub + pay rent (TenantApp); insurance / screening out |
| Tab bar | Accueil · Découvrir · Favoris · **Locations** · Profil |
| Empty / no lease | Prospect hub (visits + in-progress), not a dead empty state |
| Activity | Leave tab bar → stack `/activity`; Profile → « Mon historique » |
| Architecture | Approach 1 — new `(tabs)/locations` hub; keep `/leases/[id]` for detail |
| Data | Reuse `mock-leases` + `mock-activity` (no API wiring this pass) |
| Post-pay | Return to Locations hub (not Activity) |

## Non-goals

- Immofacile features (pige, intercabinet, Scout, ImmoLike, ImmoScope, e-sign mandate register…)
- Tenant insurance / screening (TenantApp extras)
- Fifth-tab *and* Activity both on the bar
- Real Nest lease/payment APIs
- Owner/agent surfaces on mobile
- New tab « Locations » without OTP when browsing anonymous (gate like today’s Activity)

## Navigation

```
(tabs)/
  index          Accueil
  discover       Découvrir
  favorites      Favoris
  locations      Locations   ← NEW hub (replaces activity in tab bar)
  profile        Profil

stack (outside tabs):
  activity                     ← former (tabs)/activity
  leases/index                 liste baux (optional deep entry)
  leases/[id]                  détail bail
  leases/[id]/maintenance/new
  payment/[id]                 pay rent (RENT session)
```

**Deep links**

- `/(tabs)/activity` → redirect to `/activity`
- Profile « Mes locations » → `/(tabs)/locations` (or `/leases` if we keep list as secondary; prefer hub)
- Profile « Mon historique » → `/activity`
- Activity segment Loyers / rent row → `/leases/[id]` (unchanged)

**Auth:** `ensureAuthenticated` on Locations, `/activity`, `/leases*`.

## Hub UI — `(tabs)/locations`

### Mode locataire (`ACTIVE` lease)

1. **Hero bail** — cover/title, location, status badge, agency chip  
2. **Carte « Prochain loyer »** — month label, amount FCFA, due date, status (À payer / En retard / Payé), primary CTA **Payer** → `/payment/[sessionId]` when `canPayRentLine`  
3. **Actions rapides** — Voir le bail → `/leases/[id]` · Signalement → maintenance/new · Contacter (tel agent/agence)  
4. **À venir** — next 2–3 schedule lines (compact)  
5. **Incidents** — open / in-progress tickets (compact)  
6. **Multi-bail** — if >1 `ACTIVE`, horizontal selector or chips at top; hub content follows selection  

### Mode prospect (no `ACTIVE` lease)

1. Title « Votre espace location » + short subtitle  
2. **À venir** — upcoming visits from mock activity (`visits`)  
3. **En cours** — recent bookings / sales / payments cards (compact pipeline)  
4. CTAs — Explorer (`/(tabs)/discover` or home) · Voir l’historique (`/activity`)  
5. No greyed fake rent card  

### Terminated-only

Treat like prospect for hub primary content; optionally show a « Anciens baux » link → `/leases`.

## Lease detail & payment

- Keep existing `/leases/[id]` (schedule, pay rows, maintenance list).  
- Hub is the **home**; detail is the **dossier**.  
- Pay flow reuses `/payment/[id]` with mock `RENT` sessions.  
- On payment success: navigate to `/(tabs)/locations` (and refresh mocks / tick).

## Components (suggested)

| Component | Role |
|-----------|------|
| `components/tenant/TenantHubScreen` logic in `locations.tsx` or thin orchestrator | Mode switch active vs prospect |
| `TenantRentCard` | Next rent + Payer |
| `TenantQuickActions` | Bail / signalement / contact |
| `TenantLeaseHero` | Property + status strip |
| `ProspectPipelineList` | Visits + in-progress items |
| Existing | `StatusBadge`, `AgencyChip`, payment screen |

## Data

- `listActiveLeases()` / `getPrimaryActiveLease()` helpers on `mock-leases`  
- `nextDueForLease` already exists — drive `TenantRentCard`  
- Prospect sections: filter `listMockActivity` by segment / date  
- No schema or API changes

## Profile & Activity adjustments

- Tab layout: remove `activity` from `Tabs.Screen` visible set; add `locations`  
- Move file: `app/(tabs)/activity.tsx` → `app/activity.tsx` (or hide tab via `href: null` and keep file — prefer real move + redirect)  
- Profile menu: Mes locations → Locations tab; add Mon historique → `/activity`; keep Mes documents / Réglages as today  

## Success criteria

1. Bottom bar shows Locations instead of Activité.  
2. With mock active lease: hub shows next rent + working Payer CTA.  
3. Without active lease: prospect pipeline + link to historique.  
4. Activity still reachable from Profile; old tab deep link redirects.  
5. French copy; Paradis light theme; no Immofacile/pro CRM chrome.

## Testing

- Unit: helpers for primary active lease / next due selection  
- Manual: tab switch, pay from hub → return hub, prospect mode (force no active lease in mock), Profile historique entry  

## Supersedes / relates

- Extends [2026-07-11-mobile-tenant-profile-design.md](./2026-07-11-mobile-tenant-profile-design.md) (B+D leases) with a **primary Locations tab** and demotes Activity.  
- Does not replace conversion Activity segment content — only its **placement** in IA.
