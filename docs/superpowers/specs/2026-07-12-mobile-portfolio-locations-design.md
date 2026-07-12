# Mobile Portfolio Locations (biens confondus) — Design Spec

**Date:** 2026-07-12  
**Status:** Approved in brainstorming  
**Scope:** Reframe the Locations tab as a **unified portfolio of properties** the user has converted with (visit, stay, purchase, lease). Tap opens property history — or the **rent hub** when they are an active tenant on that property. French long dates + relative due labels. UI-first on mocks.

**Supersedes (IA):** segment tabs Loyers / Séjours / Achats on Locations from the mid-iteration UI.  
**Extends:** [2026-07-12-mobile-tenant-hub-design.md](./2026-07-12-mobile-tenant-hub-design.md) (tab bar, auth, pay rent, Activity as historique).

## Goal

Show **all interacted properties in one list** (purchase + long rent + short stay + visits), not mode silos. One card per property. Tap → rent hub if active lease on that property; otherwise → per-property engagement timeline.

## Decisions

| Topic | Choice |
|-------|--------|
| List composition | **Conversion only** — visit booked, stay, sale inquiry/purchase, lease (active or terminated). No favorites-only. |
| Active tenant tap | **Direct rent hub**; « Historique du bien » secondary |
| Non-tenant tap | Property **timeline** (chronological engagements) |
| Multi-relation on one property | Single card; badge priority: **Locataire > Achat en cours > Séjour > Visite** |
| Sort | Last engagement date descending |
| Dates | Absolute `15 mai 2026`; échéances add relative (`dans 6 jours`, `dans 1 semaine`, `en retard de 3 jours`) |

## Non-goals

- Favorites in this list  
- Immofacile / RE/MAX CRM features  
- Real API aggregation (mock portfolio builder)  
- Changing tab bar (Locations stays)  
- Removing `/activity` historique (still from Profile)

## Information architecture

```
(tabs)/locations                    → portfolio list (unified)
  └─ tap property
       ├─ has ACTIVE lease on property  → /portfolio/[propertyId]/rent  (hub)
       │     └─ « Historique du bien »  → /portfolio/[propertyId]
       └─ else                          → /portfolio/[propertyId]      (timeline)
            └─ row tap may open /stays/[id] | /purchases/[id] | /leases/[id] | /property/[id]
```

Keep existing `/leases/[id]`, `/stays/[id]`, `/purchases/[id]` as deep dossiers. Rent hub can be a dedicated route or reuse lease-centric UI scoped by `propertyId` → primary active lease.

## Portfolio list (`(tabs)/locations`)

**Card**
- Cover / title / location  
- Relation badge (priority above)  
- Last activity one-liner + **formatted date**  
- If active tenant and next rent due: show due with absolute + relative  

**Empty**
- Copy + CTA Explorer  

**Data builder (mock)**  
`listPortfolioProperties(): PortfolioItem[]` aggregates by `propertyId` from:
- leases (active + terminated)  
- stays  
- purchases  
- visit activity items (segment `visits`)  

Each item: `{ propertyId, relations[], primaryRelation, lastAt, nextDue? }`.

## Rent hub (active tenant)

Same capabilities as current lease hub (switcher only if **multiple active leases**, not multiple properties in list — list already separates properties):
- Hero, next rent + **Payer**, quick actions, échéances, incidents  
- Dates via shared formatter  
- CTA « Historique du bien » → timeline  

If user has two active leases on **different** properties, they appear as **two cards** on the list (no horizontal lease switcher required on hub when opened from one property). Optional: keep switcher only when somehow multiple active leases share one property (rare — skip YAGNI).

## Timeline (`/portfolio/[propertyId]`)

- Header: property summary  
- Chronological events: visit, stay, payment, purchase step, lease start/end, rent paid  
- Event date: `15 mai 2026`  
- Tap event → stay / purchase / lease detail when id present  

## Date formatting

Shared helper e.g. `lib/format-date-fr.ts`:

```ts
formatDateFr(isoDate): string
// → "15 mai 2026" (fr-FR, day + month long + year, lowercase month OK)

formatDueLabel(isoDate, now = Date): string
// → "15 mai 2026 · dans 6 jours"
// → "15 mai 2026 · dans 1 semaine" when daysLeft >= 7 && < 14 (or round weeks when exact)
// → "15 mai 2026 · demain" / "aujourd’hui"
// → "5 mai 2026 · en retard de 3 jours" when past
```

Rules (explicit):
- Relative uses whole days from local midnight  
- `dans 1 semaine` when `daysLeft === 7` or `7..13` (prefer: `=== 7` → « dans 1 semaine », `8..13` → « dans N jours », `≥ 14` → « dans N semaines » rounded)  
  **Pick:**  
  - 0 → aujourd’hui  
  - 1 → demain  
  - 2..6 → dans N jours  
  - 7 → dans 1 semaine  
  - 8..13 → dans N jours  
  - ≥ 14 → dans X semaines (round)  
  - negative → en retard de N jour(s)  

Apply on: portfolio cards (when due), rent card, schedule rows, timeline.

## Migration from current UI

| Remove / demote | Replace with |
|-----------------|--------------|
| Locations SegmentTabs Loyers/Séjours/Achats | Unified list |
| Prospect-only empty as main for non-tenants | Portfolio empty or list of visit/stay/purchase properties |
| Lease switcher as primary IA | One card per property |

Keep stay/purchase detail screens; wire timeline and historique activity to them.

## Components (suggested)

| Piece | Role |
|-------|------|
| `listPortfolioProperties` | Aggregate mock sources |
| `PortfolioPropertyCard` | List row |
| `PropertyTimeline` | History screen body |
| `formatDateFr` / `formatDueLabel` | Shared dates |
| Existing rent hub pieces | Reuse under `/portfolio/[id]/rent` or inline |

## Testing

- Unit: portfolio aggregation (one card per property; priority badge; sort)  
- Unit: date helpers (aujourd’hui, demain, 6 jours, 1 semaine, retard)  
- Manual: tenant property → hub; visit-only → timeline; due label on card  

## Success criteria

1. Locations shows a mixed property list without mode tabs.  
2. Active lease property opens rent hub immediately.  
3. Other properties open timeline.  
4. Dates read as `15 mai 2026` and dues include relative French phrasing.  
5. Favorites alone never create a portfolio row.
