# Mobile Listing Availability (Dispo / Indispo) — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** UI-first (mocks). Roadmap pass **C**.

## Goal

Keep listings that are no longer bookable (rented, sold, reserved) **visible** on the marketplace, while making availability unmistakable: **card = distinctive border only**, **detail = badge + reason**, and **conversion CTAs hidden** when unavailable.

## Roadmap context

| Pass | Topic |
|------|--------|
| A | Official agency hub (done) |
| **C (this doc)** | Listing Dispo / Indispo |
| B + D | Tenant rentals space + richer Profile |

## Non-goals

- Nest / Prisma `PropertyStatus` changes
- « Me prévenir » / waitlist
- Removing mode badge (Vente / Location…) from cards
- Passes B / D

## Decisions

| Topic | Choice |
|-------|--------|
| States | Binary `AVAILABLE` \| `UNAVAILABLE` |
| Reason on unavailable | `RENTED` \| `SOLD` \| `RESERVED` (shown on detail only) |
| Card treatment | Specific border; **no** Dispo/Indispo badge |
| Detail treatment | Badge `Indispo · Loué|Vendu|Réservé` |
| Conversion CTAs when Indispo | Hidden; message instead |
| Share / favorites / more actions | Still available |
| Filters | « Disponibles seulement » toggle |

## Domain (mock)

```ts
type PropertyAvailability = 'AVAILABLE' | 'UNAVAILABLE';
type UnavailableReason = 'RENTED' | 'SOLD' | 'RESERVED';

// on Property
availability: PropertyAvailability; // default AVAILABLE
unavailableReason?: UnavailableReason; // set when UNAVAILABLE
```

**French labels**

| Value | Label |
|-------|--------|
| AVAILABLE | Dispo (detail only if ever shown; not on card) |
| UNAVAILABLE + RENTED | Indispo · Loué |
| UNAVAILABLE + SOLD | Indispo · Vendu |
| UNAVAILABLE + RESERVED | Indispo · Réservé |

**Helpers** (`types/property.ts` or small lib):

- `isPropertyAvailable(property): boolean`
- `propertyAvailabilityBadgeLabel(property): string | null` — null if available; else full Indispo · reason
- `unavailableReasonLabel(reason): string`

**Mocks:** at least one unavailable listing per reason where it fits modes (e.g. long-rent → RENTED, sale → SOLD, short-stay → RESERVED). Remaining mocks `AVAILABLE`.

## UI

### PropertyCard

- Keep existing mode badge (`propertyStatusLabel`).
- If `availability === 'UNAVAILABLE'`: `borderWidth: 2`, `borderColor: colors.danger` (or agreed muted-danger token).
- No availability text badge on the card.
- Card remains pressable → detail.

### Property detail

- Near trust/status row: pill with `propertyAvailabilityBadgeLabel` when unavailable (danger/warning tone).
- Floating footer:
  - Available → existing visit / book CTA + more actions
  - Unavailable → hide primary conversion CTA; show static banner « Ce bien n’est plus disponible » + short reason; keep secondary more-actions (⋯) for share / favorites / agency
- Direct deep links to `/visit`, `/book`, `/sale-inquiry` may still exist; screens can remain as-is for this pass (optional guard later). Primary UX path is blocked via hidden CTAs.

### Search / Filters

- Extend `SearchFilters` with `availableOnly: boolean` (default `false`).
- Filters UI: toggle or chip « Disponibles seulement ».
- `filterProperties` excludes `UNAVAILABLE` when `availableOnly`.
- Include in `countActiveFilters` / params (`available=1`).

## Acceptance checklist

- [ ] Unavailable listings still appear in Home / search / agency hub lists  
- [ ] Card shows distinctive border, no Dispo/Indispo badge  
- [ ] Detail shows `Indispo · {raison}`  
- [ ] Detail hides conversion CTAs; shows unavailable message  
- [ ] Share / favorites / ⋯ still work  
- [ ] « Disponibles seulement » filter works  
- [ ] French copy; UI-first mocks  

## Out of scope (explicit)

- API availability field  
- Waitlist  
- Passes B / D  
