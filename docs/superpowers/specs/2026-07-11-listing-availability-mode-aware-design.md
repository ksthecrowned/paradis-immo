# Mode-Aware Listing Availability — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** Replace flat `AVAILABLE`/`UNAVAILABLE` + `RENTED|SOLD|RESERVED` with mode-specific listing statuses; update mobile cards (grayscale, badges, refactor); list skeletons; sort marketable first; Featured ribbon via API. Short-stay book calendar UX remains a separate pass.

## Goal

Marketplace availability must match product rules per mode: sale = free, sous offre (`UNDER_OFFER`), or sold; short-stay = always listable (calendar owns real nights); long-rent = free, occupied, or soon-free with countdown (not a generic “indispo”). Visit bookings never set listing status. `UNDER_OFFER` / `SOLD` / `OCCUPIED` keep grayscale cards.

## Decisions

| Topic | Choice |
|-------|--------|
| Architecture | Approach 1 — mode-aware `listingStatus` + `availableFrom` |
| Soon-available date | Manual `availableFrom` **or** active lease `endDate` (C) |
| Sale unavailable | `SOLD` + `UNDER_OFFER` (sous offre / pending) — both grayscale, no conversion CTAs |
| Occupied long-rent CTAs | View only, no conversion (A) |
| Filter « Disponibles seulement » | `AVAILABLE` + `AVAILABLE_SOON` + all `RENT_SHORT` (A) — excludes `SOLD`, `OCCUPIED`, `UNDER_OFFER` |
| Popular ribbon | **C** — API `isFeatured`; status has its own badge |
| Card chrome | Grayscale for `SOLD`, `OCCUPIED`, **and `UNDER_OFFER`** |

## Domain & API

### Prisma

Remove `ListingAvailability` and `UnavailableReason`.

```prisma
enum ListingStatus {
  AVAILABLE
  SOLD
  UNDER_OFFER   // sale only — sous offre / pending (MLS-like)
  OCCUPIED
  AVAILABLE_SOON
}

// on Property:
listingStatus ListingStatus @default(AVAILABLE)
availableFrom DateTime?     // when AVAILABLE_SOON (manual override)
isFeatured    Boolean       @default(false)
```

**Allowed by mode** (enforce in service on create/update):

| Mode | Allowed `listingStatus` |
|------|-------------------------|
| `SALE` | `AVAILABLE`, `UNDER_OFFER`, `SOLD` |
| `RENT_SHORT` | Always treat/publish as `AVAILABLE` (ignore OCCUPIED/SOLD/UNDER_OFFER writes or coerce) |
| `RENT_LONG` | `AVAILABLE`, `OCCUPIED`, `AVAILABLE_SOON` |

**`availableFrom` resolution** (PublicProperty):

1. If status is `AVAILABLE_SOON` and `Property.availableFrom` set → use it  
2. Else if `AVAILABLE_SOON` and an active lease has `endDate` → use lease end  
3. Else if status was `AVAILABLE_SOON` but no date → coerce to `OCCUPIED` in public payload (or reject on write)

**Migration map**

| Old | New |
|-----|-----|
| `AVAILABLE` | `AVAILABLE` |
| `UNAVAILABLE` + `SOLD` | `SOLD` |
| `UNAVAILABLE` + `RENTED` | `OCCUPIED` (RENT_LONG) / `AVAILABLE` if wrongly on other mode |
| `UNAVAILABLE` + `RESERVED` on **SALE** | `UNDER_OFFER` (closest MLS pending semantics) |
| `UNAVAILABLE` + `RESERVED` on **RENT_SHORT** | `AVAILABLE` (visit ≠ listing status) |
| `UNAVAILABLE` + `RESERVED` on **RENT_LONG** | `OCCUPIED` |

### PublicProperty

```ts
listingStatus: 'AVAILABLE' | 'SOLD' | 'UNDER_OFFER' | 'OCCUPIED' | 'AVAILABLE_SOON';
availableFrom: string | null; // ISO date
isFeatured: boolean;
// remove listingAvailability, unavailableReason
```

### Seed

- One `SOLD` sale + one `UNDER_OFFER` sale (both grayscale demos)  
- One `OCCUPIED` long-rent  
- One `AVAILABLE_SOON` long-rent with `availableFrom` or lease end  
- Short-stay: `AVAILABLE` + `isFeatured` on at least one listing  
- No visit-booking side effects on listing status  

## Mobile

### Property model

Replace binary availability with:

```ts
listingStatus: 'AVAILABLE' | 'SOLD' | 'UNDER_OFFER' | 'OCCUPIED' | 'AVAILABLE_SOON';
availableFrom?: string | null;
isFeatured?: boolean;
```

Helpers (`lib/listing-status.ts`):

- `isConversionBlocked(p)` → `SOLD` \| `UNDER_OFFER` \| `OCCUPIED`  
- `isGrayscaleCard(p)` → same  
- `passesAvailableOnlyFilter(p)` → not SOLD / UNDER_OFFER / OCCUPIED (RENT_SHORT always passes)  
- `listingStatusLabel` / `daysUntilAvailable` / `sortMarketableFirst`

`mapPublicProperty` maps new fields; deprecate old `availability` / `unavailableReason` (migrate call sites).

### Card UI

- Grayscale only when `isGrayscaleCard` (`SOLD` | `UNDER_OFFER` | `OCCUPIED`)  
- Photo overlay badge = mode/status (e.g. À vendre, Sous offre, Occupé, Bientôt · J-12) — not fake Popular  
- Bottom ribbon = **Featured** (French: **« Coup de cœur »**) when `isFeatured`  
- Refactor `card.tsx` into focused pieces under `components/property/`:
  - `PropertyCard.tsx` (orchestrator)
  - `PropertyCardImage.tsx`
  - `PropertyCardBadges.tsx` (status + featured ribbon)
  - `PropertyCardBody.tsx` (location, price, title, amenities)
  - Reuse existing `PropertyCardSkeleton` (or add if missing) on Home / Search / Discover / agency Biens while loading  

### Lists

- After fetch: `sortMarketableFirst` (AVAILABLE / AVAILABLE_SOON / RENT_SHORT before SOLD / UNDER_OFFER / OCCUPIED; stable within groups)  
- Skeletons during catalog load  

### Detail

| Status | Badge | CTA |
|--------|-------|-----|
| AVAILABLE | optional soft | Normal by mode |
| AVAILABLE_SOON | countdown / date | Visit OK (long) |
| UNDER_OFFER | Sous offre | No conversion CTAs (grayscale) |
| OCCUPIED | Occupé | No conversion CTAs |
| SOLD | Vendu | No conversion CTAs |
| RENT_SHORT | — | Book → calendar (separate pass) |

### Filter

`availableOnly` uses `passesAvailableOnlyFilter`.

## Non-goals

- Full short-stay calendar book redesign (separate)  
- Web owner UI to edit `listingStatus` / `isFeatured` (follow-up OK)  
- Push when soon-available becomes free  

## Acceptance

1. SOLD / UNDER_OFFER / OCCUPIED → grayscale card, no CTA on detail  
2. AVAILABLE_SOON → color card + countdown badge; visit allowed  
3. RENT_SHORT never grayscale from listing status  
4. Featured ribbon only when `isFeatured`  
5. Lists show skeletons then marketable-first order  
6. `availableOnly` matches decision A (excludes UNDER_OFFER)  
7. No visit-driven `RESERVED` listing status; sale pending = `UNDER_OFFER`  
8. `card.tsx` split into reusable components; file no longer a 400+ line monolith  

## Follow-ups

- Owner/agent web editors for status / featured / availableFrom  
- Short-stay book calendar API pass  
- Auto-flip AVAILABLE_SOON → AVAILABLE when `availableFrom` passes (cron)  
- Auto-flip UNDER_OFFER → SOLD / AVAILABLE when deal closes or falls through  
