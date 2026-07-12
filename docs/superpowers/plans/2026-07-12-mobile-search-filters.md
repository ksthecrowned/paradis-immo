# Mobile Search Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich mobile search filters with ville → quartier, price range, bathrooms, category, property age; polish with steppers + range UI; collapse advanced options behind Afficher plus.

**Architecture:** Extend `SearchFilters` + client-side `filterProperties` on the catalog already loaded by `/search`. Enrich `Property` with `priceAmount` / location ids from `mapPublicProperty`. Rebuild `/filters` with primary sections always open and advanced under an expand toggle. No API filter push in this pass.

**Tech Stack:** Expo Router, React Native, Bun tests, `@react-native-community/slider` (dual bound via two coupled sliders), existing `lib/locations.ts`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-mobile-search-filters-design.md`
- French copy only
- Theme: Paradis light (`colors.*`) — not dark/lime refs
- Filtering: **client-only** on catalog (~50)
- Quartier chips disabled until a city is selected; changing city clears quartier
- Primary open: type · ville · quartier · prix · chambres
- Folded: sdb · type de bien · agences · équipements · dispo · âge
- Do not change Discover `?city=` deep-link in this pass

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/mobile/types/property.ts` | Add `priceAmount`, `cityId`, `cityName`, `quartierId`, `quartierName` |
| `apps/mobile/lib/map-property.ts` | Map those fields from PublicProperty |
| `apps/mobile/lib/map-property.test.ts` | Assert new fields |
| `apps/mobile/lib/mock-properties.ts` | Fill ids/priceAmount on mocks |
| `apps/mobile/lib/filter-price-bounds.ts` | Mode → slider min/max/step |
| `apps/mobile/lib/filter-price-bounds.test.ts` | Bounds tests |
| `apps/mobile/lib/search-filters.ts` | Extended model, params, filter, count |
| `apps/mobile/lib/search-filters.test.ts` | Round-trip + filter cases |
| `apps/mobile/components/filters/FilterSection.tsx` | Section title/subtitle |
| `apps/mobile/components/filters/FilterChipRow.tsx` | Chip press helpers |
| `apps/mobile/components/filters/FilterStepper.tsx` | − / value / + |
| `apps/mobile/components/filters/FilterPriceRange.tsx` | Min/max sliders + FCFA labels |
| `apps/mobile/app/filters.tsx` | Full screen orchestration + Afficher plus |
| `apps/mobile/package.json` | Add `@react-native-community/slider` |

---

### Task 1: Enrich `Property` + mapper

**Files:**
- Modify: `apps/mobile/types/property.ts`
- Modify: `apps/mobile/lib/map-property.ts`
- Modify: `apps/mobile/lib/map-property.test.ts`
- Modify: `apps/mobile/lib/mock-properties.ts`

**Interfaces:**
- Produces on `Property`:
  - `priceAmount: number`
  - `cityId?: string`
  - `cityName?: string`
  - `quartierId?: string`
  - `quartierName?: string`

- [ ] **Step 1: Extend `Property` type**

In `apps/mobile/types/property.ts`, add after `price`:

```ts
  /** Numeric amount in currency minor units / whole FCFA (from API). */
  priceAmount: number;
  cityId?: string;
  cityName?: string;
  quartierId?: string;
  quartierName?: string;
```

- [ ] **Step 2: Map fields in `mapPublicProperty`**

```ts
    price: formatPriceLabel(api.price, api.currency),
    priceAmount: api.price,
    // ...
    location: `${q}, ${city}`,
    cityId: api.quartier.arrondissement.city.id,
    cityName: city,
    quartierId: api.quartier.id,
    quartierName: q,
```

- [ ] **Step 3: Update mapper test + mocks**

Assert `priceAmount`, `cityId`, `quartierId` in `map-property.test.ts`.  
On each mock in `mock-properties.ts`, set `priceAmount` (parse from existing label if needed), and optional location ids consistent with `location` strings.

- [ ] **Step 4: Run tests**

Run: `cd apps/mobile && bun test lib/map-property.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/types/property.ts apps/mobile/lib/map-property.ts apps/mobile/lib/map-property.test.ts apps/mobile/lib/mock-properties.ts
git commit -m "$(cat <<'EOF'
feat(mobile): expose priceAmount and location ids on Property

EOF
)"
```

---

### Task 2: Price bounds helper

**Files:**
- Create: `apps/mobile/lib/filter-price-bounds.ts`
- Create: `apps/mobile/lib/filter-price-bounds.test.ts`

**Interfaces:**
- Produces:

```ts
export type PriceBounds = {
  min: number;
  max: number;
  step: number;
};

export function priceBoundsForMode(
  mode: 'ALL' | 'SALE' | 'RENT_LONG' | 'RENT_SHORT',
): PriceBounds;
```

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from 'bun:test';
import { priceBoundsForMode } from './filter-price-bounds';

describe('priceBoundsForMode', () => {
  test('SALE uses wide purchase range', () => {
    const b = priceBoundsForMode('SALE');
    expect(b.min).toBe(0);
    expect(b.max).toBe(200_000_000);
    expect(b.step).toBe(1_000_000);
  });

  test('RENT_LONG uses monthly rent range', () => {
    const b = priceBoundsForMode('RENT_LONG');
    expect(b.max).toBe(2_000_000);
    expect(b.step).toBe(25_000);
  });

  test('RENT_SHORT uses daily range', () => {
    const b = priceBoundsForMode('RENT_SHORT');
    expect(b.max).toBe(200_000);
    expect(b.step).toBe(5_000);
  });

  test('ALL uses the widest max', () => {
    expect(priceBoundsForMode('ALL').max).toBe(200_000_000);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/mobile && bun test lib/filter-price-bounds.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement**

```ts
import type { PropertyMode } from '@/types/property';

export type PriceBounds = {
  min: number;
  max: number;
  step: number;
};

const BOUNDS: Record<'ALL' | PropertyMode, PriceBounds> = {
  SALE: { min: 0, max: 200_000_000, step: 1_000_000 },
  RENT_LONG: { min: 0, max: 2_000_000, step: 25_000 },
  RENT_SHORT: { min: 0, max: 200_000, step: 5_000 },
  ALL: { min: 0, max: 200_000_000, step: 1_000_000 },
};

export function priceBoundsForMode(
  mode: 'ALL' | PropertyMode,
): PriceBounds {
  return BOUNDS[mode];
}

export function formatFilterPrice(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd apps/mobile && bun test lib/filter-price-bounds.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/filter-price-bounds.ts apps/mobile/lib/filter-price-bounds.test.ts
git commit -m "$(cat <<'EOF'
feat(mobile): add mode-aware filter price bounds

EOF
)"
```

---

### Task 3: Extend `SearchFilters` + client filtering (TDD)

**Files:**
- Modify: `apps/mobile/lib/search-filters.ts`
- Modify: `apps/mobile/lib/search-filters.test.ts`

**Interfaces:**
- Produces extended `SearchFilters` (see spec)
- `filterProperties`, `filtersToParams`, `paramsToFilters`, `countActiveFilters`, `DEFAULT_SEARCH_FILTERS` updated
- Consumes: `Property.priceAmount`, location ids, `yearBuilt`, `bathrooms`, `category`

- [ ] **Step 1: Add failing tests for new filters**

Append to `search-filters.test.ts` (extend `sample` fixtures with `priceAmount: 1` and location/category/year/bathrooms as needed for each case):

```ts
describe('location and price filters', () => {
  const located: Property[] = [
    {
      id: 'p1',
      title: 'P1',
      description: '',
      price: '100 000 FCFA',
      priceAmount: 100_000,
      coverImage: '',
      mode: 'RENT_LONG',
      lat: 0,
      lng: 0,
      agencyId: 'ag1',
      agentId: 'a1',
      listingStatus: 'AVAILABLE',
      cityId: 'c-pn',
      cityName: 'Pointe-Noire',
      quartierId: 'q-lo',
      quartierName: 'Loandjili',
      bathrooms: 1,
      bedrooms: 2,
      category: 'house',
      yearBuilt: 2024,
    },
    {
      id: 'p2',
      title: 'P2',
      description: '',
      price: '50 000 000 FCFA',
      priceAmount: 50_000_000,
      coverImage: '',
      mode: 'SALE',
      lat: 0,
      lng: 0,
      agencyId: 'ag1',
      agentId: 'a1',
      listingStatus: 'AVAILABLE',
      cityId: 'c-bzv',
      cityName: 'Brazzaville',
      quartierId: 'q-cv',
      quartierName: 'Centre-ville',
      bathrooms: 2,
      bedrooms: 3,
      category: 'apartment',
      yearBuilt: 2010,
    },
  ];

  test('filters by cityId', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      cityId: 'c-pn',
      cityName: 'Pointe-Noire',
    });
    expect(out.map((p) => p.id)).toEqual(['p1']);
  });

  test('filters by quartierId', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      cityId: 'c-bzv',
      cityName: 'Brazzaville',
      quartierId: 'q-cv',
      quartierName: 'Centre-ville',
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('filters by price range', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      minPrice: 200_000,
      maxPrice: 60_000_000,
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('filters by minBathrooms', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      minBathrooms: 2,
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('filters by categories', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      categories: ['apartment'],
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('filters by maxAgeYears', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      maxAgeYears: 2,
    });
    expect(out.map((p) => p.id)).toEqual(['p1']);
  });

  test('filters by minAgeYears (plus de N ans)', () => {
    const out = filterProperties(located, {
      ...DEFAULT_SEARCH_FILTERS,
      minAgeYears: 7,
    });
    expect(out.map((p) => p.id)).toEqual(['p2']);
  });

  test('round-trips new params', () => {
    const params = filtersToParams({
      ...DEFAULT_SEARCH_FILTERS,
      cityId: 'c-pn',
      cityName: 'Pointe-Noire',
      quartierId: 'q-lo',
      quartierName: 'Loandjili',
      minPrice: 10_000,
      maxPrice: 500_000,
      minBathrooms: 1,
      categories: ['house', 'land'],
      maxAgeYears: 5,
    });
    const back = paramsToFilters(params);
    expect(back.cityId).toBe('c-pn');
    expect(back.quartierId).toBe('q-lo');
    expect(back.minPrice).toBe(10_000);
    expect(back.maxPrice).toBe(500_000);
    expect(back.minBathrooms).toBe(1);
    expect(back.categories).toEqual(['house', 'land']);
    expect(back.maxAgeYears).toBe(5);
  });
});
```

Also update existing `sample` entries to include `priceAmount: 1` so TypeScript compiles.

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/mobile && bun test lib/search-filters.test.ts`  
Expected: FAIL on new fields / assertions

- [ ] **Step 3: Implement model + filter logic**

Update `SearchFilters` / defaults / count / params / filter:

```ts
export type SearchFilters = {
  q: string;
  mode: PropertyMode | 'ALL';
  cityId: string | null;
  cityName: string | null;
  quartierId: string | null;
  quartierName: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  minBedrooms: number | null;
  minBathrooms: number | null;
  categories: PropertyCategory[];
  features: PropertyFeatureId[];
  agencyIds: string[];
  availableOnly: boolean;
  maxAgeYears: number | null;
  minAgeYears: number | null;
};
```

In `filterProperties`, after mode check:

```ts
    if (filters.cityId && property.cityId !== filters.cityId) return false;
    if (filters.quartierId && property.quartierId !== filters.quartierId) return false;

    if (filters.minPrice != null && property.priceAmount < filters.minPrice) return false;
    if (filters.maxPrice != null && property.priceAmount > filters.maxPrice) return false;

    if (
      filters.minBathrooms != null &&
      (property.bathrooms == null || property.bathrooms < filters.minBathrooms)
    ) {
      return false;
    }

    if (
      filters.categories.length > 0 &&
      (property.category == null || !filters.categories.includes(property.category))
    ) {
      return false;
    }

    if (filters.maxAgeYears != null || filters.minAgeYears != null) {
      if (property.yearBuilt == null) return false;
      const age = new Date().getFullYear() - property.yearBuilt;
      if (filters.maxAgeYears != null && age > filters.maxAgeYears) return false;
      if (filters.minAgeYears != null && age < filters.minAgeYears) return false;
    }
```

Params keys: `city`, `cityName`, `quartier`, `quartierName`, `minPrice`, `maxPrice`, `bathrooms`, `categories`, `maxAge`, `minAge`.

`countActiveFilters`: +1 city, +1 quartier, +1 if min or max price set, +1 bathrooms, +categories.length (or +1 if any — **use +1 for the categories block** to match agencies), +1 age if either set.

- [ ] **Step 4: Run — expect PASS**

Run: `cd apps/mobile && bun test lib/search-filters.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/search-filters.ts apps/mobile/lib/search-filters.test.ts
git commit -m "$(cat <<'EOF'
feat(mobile): extend search filters for location, price, and age

EOF
)"
```

---

### Task 4: Filter UI primitives (Stepper, chips, section, price)

**Files:**
- Create: `apps/mobile/components/filters/FilterSection.tsx`
- Create: `apps/mobile/components/filters/FilterChipRow.tsx` (optional thin helper — or inline chips in screen)
- Create: `apps/mobile/components/filters/FilterStepper.tsx`
- Create: `apps/mobile/components/filters/FilterPriceRange.tsx`
- Modify: `apps/mobile/package.json` (+ lockfile) — add `@react-native-community/slider`

**Interfaces:**
- Produces:

```tsx
// FilterStepper
type FilterStepperProps = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  value: number | null; // null = Tous (display 0)
  min?: number; // default 0
  max?: number; // default 6
  onChange: (value: number | null) => void;
};

// FilterPriceRange
type FilterPriceRangeProps = {
  minBound: number;
  maxBound: number;
  step: number;
  minValue: number;
  maxValue: number;
  onChange: (min: number, max: number) => void;
};
```

- [ ] **Step 1: Install slider**

Run: `cd apps/mobile && bun add @react-native-community/slider`  
Expected: dependency added

- [ ] **Step 2: Implement `FilterSection`**

Extract from current `filters.tsx` (same styles: title 17/800, subtitle muted).

- [ ] **Step 3: Implement `FilterStepper`**

Pill row: icon + label left; circular − / number / circular + right (Paradis colors).  
Decrementing below 1 sets `null` (Tous). Display `Tous` when `value == null`.

- [ ] **Step 4: Implement `FilterPriceRange`**

Two coupled `@react-native-community/slider` rows labeled « Minimum » / « Maximum »:
- Min slider: `value=minValue`, clamp `<= maxValue - step`
- Max slider: `value=maxValue`, clamp `>= minValue + step`
- Show `formatFilterPrice` under each
- Track tint `colors.primary`, thumb `colors.primary`

(Dual overlapping thumbs deferred; coupled sliders satisfy range UX for this pass.)

- [ ] **Step 5: Smoke-check TypeScript**

Run: `cd apps/mobile && bunx tsc --noEmit`  
Expected: no errors in new files (or fix)

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/bun.lock apps/mobile/components/filters
git commit -m "$(cat <<'EOF'
feat(mobile): add filter stepper and price range controls

EOF
)"
```

---

### Task 5: Rebuild `/filters` screen

**Files:**
- Modify: `apps/mobile/app/filters.tsx`

**Interfaces:**
- Consumes: `SearchFilters`, `listCities`, `listArrondissements`, `listQuartiers`, UI primitives, `priceBoundsForMode`
- Produces: Apply → `/search` with full params; Reset clears + collapses advanced

- [ ] **Step 1: Wire state from `paramsToFilters`**

All new fields in local state. Load cities on mount. When `cityId` set, load all arrondissements then flatten quartiers (`Promise.all` listQuartiers). Clear quartier when city changes.

- [ ] **Step 2: Primary sections**

1. Type d’annonce — existing chips  
2. Ville — chips from cities  
3. Quartier — chips or disabled hint « Choisissez une ville »  
4. Prix — `FilterPriceRange` with bounds from `priceBoundsForMode(mode)`; when mode changes, clamp current min/max into new bounds  
5. Chambres — `FilterStepper`

- [ ] **Step 3: Afficher plus / moins**

`const [advancedOpen, setAdvancedOpen] = useState(false)`  
Toggle `Pressable` with chevron + badge count of active advanced filters (`minBathrooms`, categories, agencies, features, availableOnly, age).

Inside (when open):
- Salles de bain — stepper  
- Type de bien — multi chips (`house` / `apartment` / `land` / `commercial` → Maison / Appartement / Terrain / Commerce)  
- Agence — existing  
- Équipements — existing  
- Disponibilité — existing chip  
- Âge — single-select chips mapping:
  - Moins de 2 ans → `maxAgeYears=2`, `minAgeYears=null`
  - Moins de 5 ans → `maxAgeYears=5`
  - Moins de 7 ans → `maxAgeYears=7`
  - Plus de 7 ans → `minAgeYears=7`, `maxAgeYears=null`
  - Deselect → both null

- [ ] **Step 4: Reset / Apply**

Reset → `DEFAULT_SEARCH_FILTERS` fields + `setAdvancedOpen(false)`.  
Apply → build `SearchFilters` including `q: initial.q` + all fields → `router.replace({ pathname: '/search', params: filtersToParams(next) })`.

- [ ] **Step 5: Manual check**

Open Filters from Search: primary visible, advanced collapsed; pick city → quartiers appear; set price; Afficher plus → age; Apply → results shrink; Réinit. clears.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/filters.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): rebuild filters screen with location, price, and advanced fold

EOF
)"
```

---

### Task 6: Search badge + regression tests

**Files:**
- Modify: `apps/mobile/app/search.tsx` only if param typing needs update (usually none)
- Verify: `countActiveFilters` used for badge already

- [ ] **Step 1: Add count assertion for combined filters**

In `search-filters.test.ts`:

```ts
test('countActiveFilters counts location price and age', () => {
  expect(
    countActiveFilters({
      ...DEFAULT_SEARCH_FILTERS,
      cityId: 'c1',
      cityName: 'X',
      minPrice: 0,
      maxPrice: 1000,
      maxAgeYears: 5,
    }),
  ).toBe(3);
});
```

- [ ] **Step 2: Run full filter-related suite**

Run: `cd apps/mobile && bun test lib/search-filters.test.ts lib/filter-price-bounds.test.ts lib/map-property.test.ts`  
Expected: all PASS

- [ ] **Step 3: Commit if test-only changes**

```bash
git add apps/mobile/lib/search-filters.test.ts
git commit -m "$(cat <<'EOF'
test(mobile): cover active filter count for new dimensions

EOF
)"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Property enrichment | 1 |
| Price bounds by mode | 2 |
| SearchFilters + client filter + params | 3 |
| Stepper + price range UI | 4 |
| Primary layout + Afficher plus | 5 |
| Reset / Apply / city clears quartier | 5 |
| Search active badge | 3 + 6 |
| Out of scope API push / dark theme / Discover seed | — (explicitly skipped) |

## Placeholder / consistency self-review

- No TBD steps; param keys fixed (`city`, `quartier`, `maxAge`, `minAge`)
- `priceAmount` required on `Property` — mocks and tests updated in Task 1 / 3
- Categories counted as **+1 block** (same as agencies) — stated in Task 3
- Price UI = coupled dual sliders (documented deviation from overlapping thumbs)
