# Mobile Search Filters (ville, quartier, prix, …) — Design Spec

**Date:** 2026-07-12  
**Status:** Approved in brainstorming  
**Scope:** Enrich mobile `/filters` + `SearchFilters` with location, price range, bathrooms, category, property age; UX polish (slider, steppers); collapsible « Afficher plus ». Client-side filtering on the existing search catalog for this iteration.

## Goal

Let seekers narrow listings by **city → neighborhood**, **price**, and common attributes, without turning the filter screen into a wall of options. Primary filters stay visible; advanced ones fold behind **Afficher plus / Afficher moins**.

## Decisions

| Topic | Choice |
|-------|--------|
| Scope | Approach **2 + 3**: location + price + polish, plus broader attributes |
| Layout | Découpe **1** — primary open / advanced folded |
| Filtering | **Client-only** on catalog already loaded by `/search` (limit ~50) |
| Theme | Keep **Paradis light** tokens (not dark / lime from refs) |
| Location cascade | City chips → Quartier chips (quartiers loaded via city → arrondissements → quartiers; arrondissement not shown as its own step) |
| Prix UI | Dual-thumb **range slider** + FCFA min/max labels |
| Chambres / SDB | **Steppers** (− / value / +), `null` = « Tous » when at 0 / unset |
| Apply / Reset | Apply → `router.replace` `/search` with params; Reset clears all + collapses advanced |

## Filter model

Extend `SearchFilters` (`apps/mobile/lib/search-filters.ts`):

```ts
export type SearchFilters = {
  q: string;
  mode: PropertyMode | 'ALL';
  cityId: string | null;
  cityName: string | null;       // display + client match fallback
  quartierId: string | null;
  quartierName: string | null;
  minPrice: number | null;       // FCFA integer
  maxPrice: number | null;
  minBedrooms: number | null;
  minBathrooms: number | null;
  categories: PropertyCategory[]; // multi-select
  features: PropertyFeatureId[];
  agencyIds: string[];
  availableOnly: boolean;
  maxAgeYears: number | null;    // e.g. 2 | 5 | 7; null = any; special ABOVE_7 via minAgeYears
  minAgeYears: number | null;    // e.g. 7 for « Above 7 years »
};
```

**URL params** (string map via `filtersToParams` / `paramsToFilters`):  
`q`, `mode`, `city`, `cityName`, `quartier`, `quartierName`, `minPrice`, `maxPrice`, `bedrooms`, `bathrooms`, `categories` (csv), `features`, `agencies`, `available`, `maxAge`, `minAge`.

**Active count** (`countActiveFilters`): +1 for each non-default dimension (city, quartier, price range if either bound set, bedrooms, bathrooms, each category, features length, agencies block, availableOnly, age).

## Property enrichment (for client filter)

`mapPublicProperty` already has nested `quartier` / price number. Expose on `Property`:

| Field | Source |
|-------|--------|
| `priceAmount` | `api.price` (number) |
| `cityId` / `cityName` | `quartier.arrondissement.city` |
| `quartierId` / `quartierName` | `quartier` |
| `category` | already mapped |
| `yearBuilt` / `bathrooms` | already mapped |

`filterProperties` matches:

- `cityId` if set, else `cityName` substring on location/city fields  
- `quartierId` if set, else name  
- `priceAmount` within `[minPrice, maxPrice]` when bounds set  
- `bathrooms >= minBathrooms`  
- `category ∈ categories` when non-empty  
- age: if `maxAgeYears` → `yearBuilt >= now.year - maxAgeYears`; if `minAgeYears` → `yearBuilt <= now.year - minAgeYears`; properties without `yearBuilt` fail age filters when an age filter is active  

## Screen layout (`/filters`)

### Always visible

1. **Type d’annonce** — chips: Tous · À vendre · À louer · À la journée  
2. **Ville** — chips from `listCities('CG')`  
3. **Quartier** — chips after city selected; disabled empty state « Choisissez une ville »; changing city clears `quartier*`  
4. **Prix** — range slider; bounds depend on mode (sensible Congo defaults, e.g. sale 0–200M, rent long 0–2M/mois, short 0–200k/jour, ALL = widest union); labels under thumbs  
5. **Chambres** — stepper (0 = Tous, then 1+)

### Collapsed under « Afficher plus » (default closed)

6. **Salles de bain** — stepper  
7. **Type de bien** — multi chips: Maison · Appartement · Terrain · Commerce  
8. **Agence** — existing multi chips  
9. **Équipements** — existing multi chips  
10. **Disponibilité** — « Disponibles seulement »  
11. **Âge du bien** — single-select chips: Moins de 2 ans · Moins de 5 ans · Moins de 7 ans · Plus de 7 ans  

Toggle row: **Afficher plus** / **Afficher moins** with chevron. If any advanced filter is active while collapsed, show a small badge count on the toggle.

### Chrome

- Header: close · « Filtres » · « Réinit. »  
- Sticky footer: **Appliquer**  
- Light theme: `colors.bg` / `surface` / `primary` / chips as today  

## Components (suggested split)

| Piece | Role |
|-------|------|
| `app/filters.tsx` | Orchestrator + section order + expand state |
| `FilterSection` | Keep / slight polish |
| `FilterChipRow` | Shared chip pressables |
| `FilterStepper` | Label + − / value / + (chambres, sdb) |
| `FilterPriceRange` | Dual-thumb slider + FCFA formatting |
| `lib/search-filters.ts` | Model, params, `filterProperties`, tests |
| `lib/filter-price-bounds.ts` | Mode → slider min/max/step |

Prefer `@react-native-community/slider` **two instances** or a small dual-thumb implementation without new heavy deps if the project already has a slider; otherwise add one dual-range friendly package only if needed.

## Search screen impact

- `/search` keeps loading catalog then `filterProperties(catalog, filters)`  
- Filter badge uses updated `countActiveFilters`  
- Opening filters passes full `filtersToParams`  

No Discover-map city deep-link change required in this pass (Home city → Discover `?city=` stays separate). Optional later: seed filters from that param.

## Out of scope

- Server-side push of all filters to `listProperties` (hybrid follow-up)  
- Dark theme / lime accent from reference shots  
- Arrondissement as a visible filter step  
- Property age when `yearBuilt` missing (excluded when age filter on)  
- New API endpoints for « quartiers by city » (compose client-side)

## Testing

- Unit: `search-filters` — params round-trip; city/quartier/price/bathrooms/category/age filtering; active count  
- Unit: price bounds by mode  
- Manual: expand/collapse; city change clears quartier; apply → search results; reset  

## Success criteria

1. User can filter by ville + quartier + prix + chambres without opening advanced.  
2. Advanced options are one tap away and don’t clutter first paint.  
3. Applied filters survive navigation via URL params.  
4. Existing mode / features / agencies / availableOnly still work.  
