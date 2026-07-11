# Mobile Official Agency + Agency Hub Ratings — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** UI-first (mocks allowed). Pass **A** only in the agreed roadmap.

## Goal

Clarify that **Paradis Immo is both the marketplace platform and an official agency** on that marketplace. Surface « Agence Paradis Immo » with an **Officiel** badge, pin it first in discovery, and reshape `/agency/[id]` into a **profile-style hub** (identity card, ratings, deal-success bar, tabs **Biens | Agents | Avis**) inspired by the attached profile reference — adapted to Paradis Immo **light** theme (`#7065F0`), not dark mode.

Success = a user can open the official agency from Home, see ratings/reviews on the hub, and see property trust chips name the managing agency (not a vague « Paradis Immo » platform-only string).

## Roadmap (out of this spec)

Agreed order for later specs:

| Pass | Topic |
|------|--------|
| **A** (this doc) | Official agency + hub ratings UI |
| **C** | Listing real status (rented / sold / available) while staying visible |
| **B + D** | Tenant managed-rentals space + richer Profile |

## Non-goals (pass A)

- Nest API / real review submission
- Dark mode matching the Figma reference
- « Historique / Past transactions » tab
- Leaving a review from the app
- Passes C, B, D

## Decisions

| Topic | Choice |
|-------|--------|
| Official agency prominence | First in lists + badge « Officiel » + brand primary tint |
| Naming | « Agence Paradis Immo » (distinct from platform chrome) |
| Trust chip on property detail | `Annonce vérifiée · {agency.shortName}` |
| Hub tabs | Biens \| Agents \| Avis |
| Architecture | Extend existing Agency mocks with `isOfficial` + ratings (approach 1) |
| Visual | Profile-card hub inspired by reference; light theme |

## Domain (mock)

```ts
type Agency = {
  // existing fields…
  isOfficial: boolean;
  rating: number;          // e.g. 4.9
  reviewCount: number;
  dealSuccessPercent: number; // 0–100
};

type AgencyReview = {
  id: string;
  agencyId: string;
  authorName: string;
  propertyTitle: string;
  body: string;
  rating: number; // 1–5
  createdLabel: string; // e.g. « Il y a 2 semaines »
};
```

**Catalog:**
- One official agency: id e.g. `ag-paradis-immo`, name « Agence Paradis Immo », shortName « Paradis Immo », `logoColor: #7065F0`, `isOfficial: true`, `verified: true`
- Keep ≥ 2 third-party agencies
- ≥ 2 agents under the official agency; ≥ 1 property assigned to it
- Mock reviews for official + at least one other agency

**Helpers:**
- `listAgencies()` — official first, then others
- `listAgencyReviews(agencyId)`
- `isOfficialAgency(id)` (optional thin wrapper)

## Components / screens

| Piece | Change |
|-------|--------|
| `AgencyChip` | Optional « Officiel » pill when `isOfficial` |
| `/agency/[id]` | Profile-style header + 3 tabs including **Avis** |
| Property detail trust chip | Use managing agency `shortName` |
| Home / Filters agency lists | Consume sorted `listAgencies()` |

### Agency hub layout

1. **Top bar** — back + call agency  
2. **Identity card** (surface, rounded) — logo, name, stars + rating + review count, « Officiel » / « Top » (e.g. rating ≥ 4.8), address, phone, tagline as specialty line, deal-success progress bar  
3. **SegmentTabs** — Biens | Agents | Avis  
4. **Biens / Agents** — existing behavior (agent tap filters Biens)  
5. **Avis** — list rows: avatar initials, property title, body snippet, star row; empty state if none  

French copy; touch ≥ 44pt; no dark theme.

## Property detail

Replace static « Annonce vérifiée · Paradis Immo » with:

`Annonce vérifiée · {getAgency(property.agencyId)?.shortName ?? 'Agence'}`

Platform brand remains in app chrome (logo, tabs); agency identity is explicit on listing trust + hub.

## Acceptance checklist

- [ ] Agence Paradis Immo first on Home agency row and in Filters  
- [ ] Officiel badge on chip and/or hub  
- [ ] Hub identity card: rating, review count, deal-success bar, address/phone  
- [ ] Tabs Biens | Agents | Avis with mock content  
- [ ] Property trust chip uses agency shortName  
- [ ] Official agency uses `#7065F0`; French; UI-first mocks only  

## Spec coverage note

This document supersedes the brand-posture row in `2026-07-11-mobile-multi-agency-ui-design.md` for mobile: Paradis Immo is **platform + official agency**, not platform-only in marketplace UI.
