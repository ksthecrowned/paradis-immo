# Mode-Aware Listing Availability — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** Replace flat `AVAILABLE`/`UNAVAILABLE` + `RENTED|SOLD|RESERVED` with mode-specific listing statuses; update mobile cards (grayscale, badges, refactor); list skeletons; sort marketable first; Featured ribbon via API. Short-stay book calendar UX remains a separate pass.

## Goal

Marketplace availability must match product rules per mode: sale = free or sold; short-stay = always listable (calendar owns real nights); long-rent = free, occupied, or soon-free with countdown (not a generic “indispo”). Visit bookings never set listing status.

## Decisions

| Topic | Choice |
|-------|--------|
| Architecture | Approach 1 — mode-aware `listingStatus` + `availableFrom` |
| Soon-available date | Manual `availableFrom` **or** active lease `endDate` (C) |
| Sale unavailable | `SOLD` only — no `RESERVED` |
| Occupied long-rent CTAs | View only, no conversion (A) |
| Filter « Disponibles seulement » | `AVAILABLE` + `AVAILABLE_SOON` + all `RENT_SHORT` (A) |
| Popular ribbon | **C** — API `isFeatured`; status has its own badge |
| Card chrome | Grayscale for `SOLD` / `OCCUPIED` only |

## Domain & API

### Prisma

Remove `ListingAvailability` and `UnavailableReason`.

```prisma
enum ListingStatus {
  AVAILABLE
  SOLD
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
| `SALE` | `AVAILABLE`, `SOLD` |
| `RENT_SHORT` | Always treat/publish as `AVAILABLE` (ignore OCCUPIED/SOLD writes or coerce) |
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
| `UNAVAILABLE` + `RESERVED` | `AVAILABLE` (visit ≠ listing status) |

### PublicProperty

```ts
listingStatus: 'AVAILABLE' | 'SOLD' | 'OCCUPIED' | 'AVAILABLE_SOON';
availableFrom: string | null; // ISO date
isFeatured: boolean;
// remove listingAvailability, unavailableReason
```

### Seed

- One `SOLD` sale (grayscale demo)  
- One `OCCUPIED` long-rent  
- One `AVAILABLE_SOON` long-rent with `availableFrom` or lease end  
- Short-stay: `AVAILABLE` + `isFeatured` on at least one listing  
- Drop RESERVED usages  

## Mobile

### Property model

Replace binary availability with:

```ts
listingStatus: 'AVAILABLE' | 'SOLD' | 'OCCUPIED' | 'AVAILABLE_SOON';
availableFrom?: string | null;
isFeatured?: boolean;
```

Helpers (`lib/listing-status.ts`):

- `isConversionBlocked(p)` → `SOLD` \| `OCCUPIED`  
- `isGrayscaleCard(p)` → same  
- `passesAvailableOnlyFilter(p)` → not SOLD/OCCUPIED (RENT_SHORT always passes)  
- `listingStatusLabel` / `daysUntilAvailable` / `sortMarketableFirst`

`mapPublicProperty` maps new fields; deprecate old `availability` / `unavailableReason` (migrate call sites).

### Card UI

- Grayscale only when `isGrayscaleCard`  
- Photo overlay badge = mode/status (e.g. À vendre, Occupé, Bientôt · J-12) — not fake Popular  
- Bottom ribbon = **Featured** (French: « Coup de cœur » or keep « Popular » only if product insists — prefer **« Coup de cœur »**) when `isFeatured`  
- Refactor `card.tsx` into focused pieces under `components/property/`:
  - `PropertyCard.tsx` (orchestrator)
  - `PropertyCardImage.tsx`
  - `PropertyCardBadges.tsx` (status + featured ribbon)
  - `PropertyCardBody.tsx` (location, price, title, amenities)
  - Reuse existing `PropertyCardSkeleton` (or add if missing) on Home / Search / Discover / agency Biens while loading  

### Lists

- After fetch: `sortMarketableFirst` (AVAILABLE / AVAILABLE_SOON / RENT_SHORT before SOLD / OCCUPIED; stable within groups)  
- Skeletons during catalog load  

### Detail

| Status | Badge | CTA |
|--------|-------|-----|
| AVAILABLE | optional soft | Normal by mode |
| AVAILABLE_SOON | countdown / date | Visit OK (long) |
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

1. SOLD / OCCUPIED → grayscale card, no CTA on detail  
2. AVAILABLE_SOON → color card + countdown badge; visit allowed  
3. RENT_SHORT never grayscale from listing status  
4. Featured ribbon only when `isFeatured`  
5. Lists show skeletons then marketable-first order  
6. `availableOnly` matches decision A  
7. No `RESERVED` in API or mobile  
8. `card.tsx` split into reusable components; file no longer a 400+ line monolith  

## Follow-ups

- Owner/agent web editors for status / featured / availableFrom  
- Short-stay book calendar API pass  
- Auto-flip AVAILABLE_SOON → AVAILABLE when `availableFrom` passes (cron)
