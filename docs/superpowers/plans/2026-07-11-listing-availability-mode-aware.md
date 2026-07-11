# Mode-Aware Listing Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace flat `listingAvailability` / `unavailableReason` with mode-aware `listingStatus` (+ `availableFrom`, `isFeatured`), wire PublicProperty + mobile cards/filters/detail, keep grayscale for SOLD / UNDER_OFFER / OCCUPIED.

**Architecture:** Prisma `ListingStatus` enum on `Property`; `toPublic` resolves `availableFrom` from column or active lease end; mobile helpers in `lib/listing-status.ts`; card split under `components/property/` with grayscale + « Coup de cœur » ribbon; catalog sorts marketable-first and shows skeletons while loading.

**Tech Stack:** NestJS, Prisma (PostgreSQL), Expo / React Native, Bun tests (mobile), Jest (API).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-listing-availability-mode-aware-design.md`
- French copy only
- Grayscale for `SOLD` | `UNDER_OFFER` | `OCCUPIED` only
- Featured ribbon label: **« Coup de cœur »** (only when `isFeatured`)
- Do **not** rename Prisma relation `availability` (`AvailabilityBlock[]`)
- Short-stay book calendar redesign is out of scope
- Web owner/agent editors for status/featured are out of scope
- Visit booking must never set `listingStatus`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | `ListingStatus`; drop old enums/columns; add `listingStatus`, `availableFrom`, `isFeatured` |
| `apps/api/prisma/migrations/…` | Data migration SQL |
| `apps/api/src/common/constants/seed-ids.ts` | `propUnderOffer`, `propRentSoon` (+ media ids) |
| `apps/api/prisma/seed.ts` | Status demos per mode |
| `apps/api/src/properties/listing-status.ts` | Mode allow-list + resolve public status/date |
| `apps/api/src/properties/listing-status.spec.ts` | Unit tests for resolve/validate |
| `apps/api/src/properties/properties.service.ts` | `PublicProperty`, `publicInclude`, `toPublic`, create/update validation |
| `apps/api/src/properties/dto/create-property.dto.ts` | Optional `listingStatus` / `availableFrom` / `isFeatured` on update |
| `apps/mobile/types/property.ts` | `ListingStatus` on `Property`; remove binary availability |
| `apps/mobile/lib/listing-status.ts` | Helpers + labels + sort |
| `apps/mobile/lib/listing-status.test.ts` | Bun tests |
| `apps/mobile/lib/properties.ts` | `PublicProperty` fields |
| `apps/mobile/lib/map-property.ts` + test | Map new fields |
| `apps/mobile/lib/catalog.ts` | `sortMarketableFirst` after fetch |
| `apps/mobile/lib/search-filters.ts` + test | `passesAvailableOnlyFilter` |
| `apps/mobile/lib/mock-properties.ts` | Align mocks |
| `apps/mobile/components/property/PropertyCard.tsx` | Orchestrator |
| `apps/mobile/components/property/PropertyCardImage.tsx` | Image + grayscale |
| `apps/mobile/components/property/PropertyCardBadges.tsx` | Status badge + featured ribbon |
| `apps/mobile/components/property/PropertyCardBody.tsx` | Location / price / title / amenities |
| `apps/mobile/components/property/PropertyCardSkeleton.tsx` | List loading skeleton |
| `apps/mobile/components/property/card.tsx` | Re-export default `PropertyCard` (stable import path) |
| `apps/mobile/app/(tabs)/index.tsx` | Skeletons while `catalogLoading` |
| `apps/mobile/app/search.tsx` | Skeletons |
| `apps/mobile/app/(tabs)/discover.tsx` | Skeletons |
| `apps/mobile/app/agency/[id].tsx` | Skeletons on Biens |
| `apps/mobile/app/property/[id]/index.tsx` | Status badge + block CTAs via `isConversionBlocked` |

---

### Task 1: Prisma — `ListingStatus` migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration via `prisma migrate dev`

**Interfaces:**
- Produces: `ListingStatus` enum; `Property.listingStatus`, `Property.availableFrom`, `Property.isFeatured`
- Removes: `ListingAvailability`, `UnavailableReason`, `listingAvailability`, `unavailableReason`

- [ ] **Step 1: Update schema**

Replace enums and Property fields:

```prisma
enum ListingStatus {
  AVAILABLE
  SOLD
  UNDER_OFFER
  OCCUPIED
  AVAILABLE_SOON
}

// on Property — REMOVE listingAvailability / unavailableReason; ADD:
  listingStatus ListingStatus @default(AVAILABLE)
  availableFrom DateTime?
  isFeatured    Boolean       @default(false)
```

Delete `enum ListingAvailability` and `enum UnavailableReason`.

- [ ] **Step 2: Create migration with data map**

```bash
cd apps/api && bunx prisma migrate dev --name listing_status_mode_aware --create-only
```

Edit the generated SQL so it:

1. Creates `ListingStatus` enum  
2. Adds `listingStatus`, `availableFrom`, `isFeatured` (nullable/defaulted)  
3. Backfills:

```sql
UPDATE "Property" SET "listingStatus" = 'AVAILABLE'
WHERE "listingAvailability" = 'AVAILABLE';

UPDATE "Property" SET "listingStatus" = 'SOLD'
WHERE "listingAvailability" = 'UNAVAILABLE' AND "unavailableReason" = 'SOLD';

UPDATE "Property" SET "listingStatus" = 'OCCUPIED'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RENTED'
  AND "mode" = 'RENT_LONG';

UPDATE "Property" SET "listingStatus" = 'UNDER_OFFER'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RESERVED'
  AND "mode" = 'SALE';

UPDATE "Property" SET "listingStatus" = 'AVAILABLE'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RESERVED'
  AND "mode" = 'RENT_SHORT';

UPDATE "Property" SET "listingStatus" = 'OCCUPIED'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RESERVED'
  AND "mode" = 'RENT_LONG';

UPDATE "Property" SET "listingStatus" = 'AVAILABLE'
WHERE "listingAvailability" = 'UNAVAILABLE'
  AND "unavailableReason" = 'RENTED'
  AND "mode" <> 'RENT_LONG';
```

4. Drops `unavailableReason`, `listingAvailability`, then old enums.

- [ ] **Step 3: Apply migration**

```bash
cd apps/api && bunx prisma migrate dev
```

Expected: migrate applies; Prisma client regenerated.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma
git commit -m "$(cat <<'EOF'
feat(api): replace listingAvailability with mode-aware listingStatus

EOF
)"
```

---

### Task 2: Seed demos (SOLD, UNDER_OFFER, OCCUPIED, AVAILABLE_SOON, featured)

**Files:**
- Modify: `apps/api/src/common/constants/seed-ids.ts`
- Modify: `apps/api/prisma/seed.ts`

**Interfaces:**
- Consumes: `ListingStatus` from `@prisma/client`
- Produces: stable IDs `propUnderOffer`, `propRentSoon` (+ 2–3 media UUIDs each)

Seed matrix:

| ID | Mode | `listingStatus` | Extra |
|----|------|-----------------|-------|
| `propRentLong` | RENT_LONG | `OCCUPIED` | keep FREE visits |
| `propSale` | SALE | `AVAILABLE` | keep PAID visits |
| `propShort` | RENT_SHORT | `AVAILABLE` | `isFeatured: true` |
| `propLand` | SALE | `SOLD` | grayscale demo |
| `propUnderOffer` | SALE | `UNDER_OFFER` | grayscale + « Sous offre » |
| `propRentSoon` | RENT_LONG | `AVAILABLE_SOON` | `availableFrom` = now + 12 days |

- [ ] **Step 1: Add fixed UUIDs** to `SEED_IDS` (do not regenerate existing ones):

```ts
propUnderOffer: '<new-uuid>',
propRentSoon: '<new-uuid>',
mediaUnderOffer: ['<uuid>', '<uuid>'],
mediaRentSoon: ['<uuid>', '<uuid>'],
```

Generate with `bun -e "console.log(crypto.randomUUID())"` (four times for props+media as needed).

- [ ] **Step 2: Patch seed upserts**

- Import `ListingStatus`; remove `ListingAvailability` / `UnavailableReason` usages.  
- Set fields per matrix; clear old `listingAvailability` / `unavailableReason`.  
- Upsert `propUnderOffer` (HOUSE, SALE, modest price) and `propRentSoon` (APARTMENT, RENT_LONG) with media via existing `upsertPropertyMedia`.  
- Reuse existing R2 image indices if upload script indexes are limited (e.g. recycle `[1,2]` / `[3,4]`).

- [ ] **Step 3: Re-seed**

```bash
cd apps/api && bun run prisma:seed
```

Expected: console lists 6 properties including UNDER_OFFER and AVAILABLE_SOON.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/constants/seed-ids.ts apps/api/prisma/seed.ts
git commit -m "$(cat <<'EOF'
feat(api): seed mode-aware listing statuses including sous offre

EOF
)"
```

---

### Task 3: API resolve + validate + `PublicProperty`

**Files:**
- Create: `apps/api/src/properties/listing-status.ts`
- Create: `apps/api/src/properties/listing-status.spec.ts`
- Modify: `apps/api/src/properties/properties.service.ts`
- Modify: `apps/api/src/properties/dto/create-property.dto.ts` (Update only is enough)

**Interfaces:**
- Produces:

```ts
export type ListingStatusValue =
  | 'AVAILABLE'
  | 'SOLD'
  | 'UNDER_OFFER'
  | 'OCCUPIED'
  | 'AVAILABLE_SOON';

export function assertListingStatusForMode(
  mode: string,
  status: ListingStatusValue,
): void; // throws BadRequestException if illegal

export function resolvePublicListing(input: {
  mode: string;
  listingStatus: ListingStatusValue;
  availableFrom: Date | null;
  activeLeaseEndDate: Date | null;
}): { listingStatus: ListingStatusValue; availableFrom: string | null };
```

Mode allow-list (from spec):

| Mode | Allowed |
|------|---------|
| SALE | AVAILABLE, UNDER_OFFER, SOLD |
| RENT_SHORT | coerce always to AVAILABLE |
| RENT_LONG | AVAILABLE, OCCUPIED, AVAILABLE_SOON |

`resolvePublicListing`:

1. If mode `RENT_SHORT` → `{ AVAILABLE, null }`  
2. If status `AVAILABLE_SOON`: use `availableFrom` else `activeLeaseEndDate`; if neither → coerce to `OCCUPIED` + `null`  
3. Else return status + `availableFrom` only when `AVAILABLE_SOON`

`PublicProperty` fields:

```ts
listingStatus: ListingStatusValue;
availableFrom: string | null;
isFeatured: boolean;
// remove listingAvailability, unavailableReason
```

- [ ] **Step 1: Failing Jest tests** in `listing-status.spec.ts`

```ts
describe('resolvePublicListing', () => {
  it('coerces RENT_SHORT to AVAILABLE', () => {
    expect(
      resolvePublicListing({
        mode: 'RENT_SHORT',
        listingStatus: 'OCCUPIED',
        availableFrom: null,
        activeLeaseEndDate: null,
      }),
    ).toEqual({ listingStatus: 'AVAILABLE', availableFrom: null });
  });

  it('uses lease end when AVAILABLE_SOON and no manual date', () => {
    const end = new Date('2026-08-01T00:00:00.000Z');
    expect(
      resolvePublicListing({
        mode: 'RENT_LONG',
        listingStatus: 'AVAILABLE_SOON',
        availableFrom: null,
        activeLeaseEndDate: end,
      }).availableFrom,
    ).toBe(end.toISOString());
  });

  it('coerces AVAILABLE_SOON without date to OCCUPIED', () => {
    expect(
      resolvePublicListing({
        mode: 'RENT_LONG',
        listingStatus: 'AVAILABLE_SOON',
        availableFrom: null,
        activeLeaseEndDate: null,
      }).listingStatus,
    ).toBe('OCCUPIED');
  });
});

describe('assertListingStatusForMode', () => {
  it('rejects UNDER_OFFER on RENT_LONG', () => {
    expect(() =>
      assertListingStatusForMode('RENT_LONG', 'UNDER_OFFER'),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/properties/listing-status.spec.ts --no-coverage
```

- [ ] **Step 3: Implement `listing-status.ts`** then wire service:

- `publicInclude()` add:

```ts
leases: {
  where: { status: 'ACTIVE' },
  orderBy: { endDate: 'asc' },
  take: 1,
  select: { endDate: true },
},
```

- In `toPublic`, call `resolvePublicListing` with `p.listingStatus`, `p.availableFrom`, `p.leases?.[0]?.endDate ?? null`; expose `isFeatured: Boolean(p.isFeatured)`.  
- On create/update when DTO provides `listingStatus`, call `assertListingStatusForMode`; for `RENT_SHORT` force `AVAILABLE`.  
- Add optional fields on `UpdatePropertyDto`:

```ts
@IsOptional() @IsEnum(ListingStatus)
listingStatus?: ListingStatus;

@IsOptional() @IsDateString()
availableFrom?: string | null;

@IsOptional() @IsBoolean()
isFeatured?: boolean;
```

(Import `ListingStatus` from `@prisma/client` or mirror string enum for class-validator.)

- [ ] **Step 4: Run tests — PASS**

```bash
cd apps/api && bunx jest src/properties/listing-status.spec.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/properties
git commit -m "$(cat <<'EOF'
feat(api): resolve and validate mode-aware listingStatus on PublicProperty

EOF
)"
```

---

### Task 4: Mobile `listing-status` helpers + Property type

**Files:**
- Create: `apps/mobile/lib/listing-status.ts`
- Create: `apps/mobile/lib/listing-status.test.ts`
- Modify: `apps/mobile/types/property.ts`
- Delete or gut: `apps/mobile/lib/property-availability.test.ts` (move assertions here)

**Interfaces:**
- Produces:

```ts
export type ListingStatus =
  | 'AVAILABLE'
  | 'SOLD'
  | 'UNDER_OFFER'
  | 'OCCUPIED'
  | 'AVAILABLE_SOON';

// on Property:
listingStatus: ListingStatus;
availableFrom?: string | null;
isFeatured?: boolean;
// remove availability, unavailableReason

export function isConversionBlocked(p: Pick<Property, 'listingStatus'>): boolean;
export function isGrayscaleCard(p: Pick<Property, 'listingStatus'>): boolean;
export function passesAvailableOnlyFilter(
  p: Pick<Property, 'listingStatus' | 'mode'>,
): boolean;
export function listingStatusLabel(p: Property): string | null;
export function daysUntilAvailable(availableFrom: string | null | undefined): number | null;
export function sortMarketableFirst<T extends Pick<Property, 'listingStatus' | 'mode'>>(
  items: T[],
): T[];
```

Semantics:

- `isConversionBlocked` / `isGrayscaleCard` → `SOLD` | `UNDER_OFFER` | `OCCUPIED`  
- `passesAvailableOnlyFilter` → `RENT_SHORT` always true; else not in blocked set (`AVAILABLE` + `AVAILABLE_SOON` pass)  
- `listingStatusLabel`:  
  - AVAILABLE → `null`  
  - UNDER_OFFER → `Sous offre`  
  - OCCUPIED → `Occupé`  
  - SOLD → `Vendu`  
  - AVAILABLE_SOON → `Bientôt · J-${n}` if days known, else `Bientôt disponible`  
- `sortMarketableFirst`: rank 0 = AVAILABLE / AVAILABLE_SOON / RENT_SHORT; rank 1 = blocked; stable sort within ranks  
- Replace `isPropertyAvailable` / `propertyAvailabilityBadgeLabel` / `unavailableReasonLabel` with the helpers above (update all imports)

- [ ] **Step 1: Failing Bun tests**

```ts
import { describe, expect, test } from 'bun:test';
import {
  isGrayscaleCard,
  listingStatusLabel,
  passesAvailableOnlyFilter,
  sortMarketableFirst,
} from './listing-status';

const base = {
  id: 'x',
  title: 'T',
  description: '',
  price: '1',
  coverImage: '',
  lat: 0,
  lng: 0,
  agencyId: 'a',
  agentId: 'b',
  mode: 'SALE' as const,
  listingStatus: 'AVAILABLE' as const,
};

test('UNDER_OFFER is grayscale and fails availableOnly', () => {
  const p = { ...base, listingStatus: 'UNDER_OFFER' as const };
  expect(isGrayscaleCard(p)).toBe(true);
  expect(passesAvailableOnlyFilter(p)).toBe(false);
  expect(listingStatusLabel(p as never)).toBe('Sous offre');
});

test('RENT_SHORT always passes availableOnly', () => {
  expect(
    passesAvailableOnlyFilter({
      mode: 'RENT_SHORT',
      listingStatus: 'AVAILABLE',
    }),
  ).toBe(true);
});

test('sortMarketableFirst puts SOLD after AVAILABLE', () => {
  const sorted = sortMarketableFirst([
    { ...base, id: 's', listingStatus: 'SOLD' as const },
    { ...base, id: 'a', listingStatus: 'AVAILABLE' as const },
  ]);
  expect(sorted.map((x) => x.id)).toEqual(['a', 's']);
});
```

- [ ] **Step 2: Run — FAIL**

```bash
cd apps/mobile && bun test lib/listing-status.test.ts
```

- [ ] **Step 3: Implement helpers + update `Property` type**; fix compile errors in call sites that still use `availability` (minimal stubs OK until later tasks if needed — prefer updating to `listingStatus: 'AVAILABLE'`).

- [ ] **Step 4: Run — PASS**

```bash
cd apps/mobile && bun test lib/listing-status.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/types/property.ts apps/mobile/lib/listing-status.ts apps/mobile/lib/listing-status.test.ts apps/mobile/lib/property-availability.test.ts
git commit -m "$(cat <<'EOF'
feat(mobile): add listingStatus helpers and Property fields

EOF
)"
```

---

### Task 5: Map API → Property + catalog sort + filters

**Files:**
- Modify: `apps/mobile/lib/properties.ts`
- Modify: `apps/mobile/lib/map-property.ts`
- Modify: `apps/mobile/lib/map-property.test.ts`
- Modify: `apps/mobile/lib/catalog.ts`
- Modify: `apps/mobile/lib/search-filters.ts`
- Modify: `apps/mobile/lib/search-filters.test.ts`
- Modify: `apps/mobile/lib/mock-properties.ts`

**Interfaces:**
- Consumes: API `listingStatus`, `availableFrom`, `isFeatured`
- Produces: mapped `Property`; `fetchCatalogProperties` returns `sortMarketableFirst(...)`

- [ ] **Step 1: Update `PublicProperty`**

```ts
listingStatus?: ListingStatus;
availableFrom?: string | null;
isFeatured?: boolean;
// remove listingAvailability, unavailableReason
```

- [ ] **Step 2: Failing map test**

```ts
test('maps UNDER_OFFER and featured', () => {
  const p = mapPublicProperty({
    ...base,
    mode: 'SALE',
    listingStatus: 'UNDER_OFFER',
    availableFrom: null,
    isFeatured: true,
  });
  expect(p.listingStatus).toBe('UNDER_OFFER');
  expect(p.isFeatured).toBe(true);
});
```

Remove assertions on `availability` / `unavailableReason`.

- [ ] **Step 3: Implement `mapPublicProperty`**

```ts
listingStatus: (api.listingStatus ?? 'AVAILABLE') as ListingStatus,
availableFrom: api.availableFrom ?? null,
isFeatured: Boolean(api.isFeatured),
```

- [ ] **Step 4: `catalog.ts`**

```ts
import { sortMarketableFirst } from '@/lib/listing-status';

export async function fetchCatalogProperties(...): Promise<Property[]> {
  const rows = await listProperties(filters);
  return sortMarketableFirst(rows.map(mapPublicProperty));
}
```

- [ ] **Step 5: `search-filters.ts`** — use `passesAvailableOnlyFilter` instead of `isPropertyAvailable`. Update tests for SOLD / UNDER_OFFER / AVAILABLE_SOON / RENT_SHORT.

- [ ] **Step 6: Align mocks** in `mock-properties.ts` to `listingStatus` / `isFeatured`.

- [ ] **Step 7: Run**

```bash
cd apps/mobile && bun test lib/map-property.test.ts lib/search-filters.test.ts lib/listing-status.test.ts
```

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/lib
git commit -m "$(cat <<'EOF'
feat(mobile): map listingStatus and sort marketable-first in catalog

EOF
)"
```

---

### Task 6: Split PropertyCard + grayscale + Coup de cœur + skeleton

**Files:**
- Create: `PropertyCardImage.tsx`, `PropertyCardBadges.tsx`, `PropertyCardBody.tsx`, `PropertyCard.tsx`, `PropertyCardSkeleton.tsx`
- Modify: `apps/mobile/components/property/card.tsx` → re-export only

**Interfaces:**
- Consumes: `isGrayscaleCard`, `listingStatusLabel`, `propertyStatusLabel`, `isFeatured`
- Produces: same `PropertyCardProps` as today; default export from `card.tsx` unchanged for callers

Behavior:

- Image: `filter: 'grayscale(100%)'` when `isGrayscaleCard(property)`  
- Overlay badge: prefer `listingStatusLabel(property)` when non-null; else `propertyStatusLabel(property)`  
- Muted gray chrome (`#6B7280`) when grayscale  
- Featured ribbon **only if** `property.isFeatured`; text **« Coup de cœur »** (not « Popular »)  
- Compact variant preserved  

Skeleton: rounded card matching default card height (~image 210 + body), `colors.border` / muted pulse or static gray blocks (no new deps).

- [ ] **Step 1: Extract components** — move styles with the piece that owns them; `PropertyCard.tsx` owns favorite state + Pressable shell.

- [ ] **Step 2: `card.tsx`**

```ts
export { default, type PropertyCardProps } from './PropertyCard';
export { default as PropertyCardSkeleton } from './PropertyCardSkeleton';
```

- [ ] **Step 3: Manual check** — TypeScript: `cd apps/mobile && bunx tsc --noEmit` (or project usual check). Fix imports.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/property
git commit -m "$(cat <<'EOF'
refactor(mobile): split PropertyCard and wire grayscale + Coup de cœur

EOF
)"
```

---

### Task 7: List skeletons + detail CTAs

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/search.tsx`
- Modify: `apps/mobile/app/(tabs)/discover.tsx`
- Modify: `apps/mobile/app/agency/[id].tsx`
- Modify: `apps/mobile/app/property/[id]/index.tsx`
- Modify: any remaining `isPropertyAvailable` / `propertyAvailabilityBadgeLabel` imports

**Interfaces:**
- Consumes: `PropertyCardSkeleton`, `isConversionBlocked`, `listingStatusLabel`

- [ ] **Step 1: Lists** — while loading catalog/agency biens, render 3–6 `PropertyCardSkeleton` in the list area instead of empty / spinner-only (keep existing error/empty states after load).

- [ ] **Step 2: Detail**

```ts
const blocked = isConversionBlocked(property);
const statusBadge = listingStatusLabel(property);
```

- Show `statusBadge` where old indispo badge was (e.g. `Sous offre`, `Occupé`, `Vendu`, `Bientôt · J-12`).  
- Hide conversion CTA footer when `blocked` (same as old `!available`).  
- AVAILABLE_SOON: CTAs allowed (visit).  
- UNDER_OFFER / SOLD / OCCUPIED: no visit/book/sale CTAs.

- [ ] **Step 3: Grep cleanup**

```bash
cd apps/mobile && rg "availability|unavailableReason|isPropertyAvailable|propertyAvailabilityBadgeLabel|ListingAvailability" --glob '!node_modules/**'
```

Expected: no leftover binary availability usage in app/lib/types (except comments if any).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app apps/mobile/types apps/mobile/lib
git commit -m "$(cat <<'EOF'
feat(mobile): skeletons, status badges, and block CTAs for dead listings

EOF
)"
```

---

### Task 8: Acceptance smoke

**Files:** none (verify only)

- [ ] **Step 1: API up + seed** (if needed)

```bash
cd apps/api && bun run prisma:seed
```

- [ ] **Step 2: Curl public list** (auth as used by mobile / public endpoint)

```bash
# adjust host/port to local API
curl -s 'http://localhost:3000/properties?status=ACTIVE&limit=20' | bun -e 'const d=[];process.stdin.on("data",c=>d.push(c));process.stdin.on("end",()=>{const j=JSON.parse(Buffer.concat(d).toString());console.log(j.data.map(p=>({title:p.title,listingStatus:p.listingStatus,isFeatured:p.isFeatured,availableFrom:p.availableFrom})))})'
```

Expected: rows include `SOLD`, `UNDER_OFFER`, `OCCUPIED`, `AVAILABLE_SOON`, featured short-stay; no `listingAvailability`.

- [ ] **Step 3: Mobile tests**

```bash
cd apps/mobile && bun test lib/listing-status.test.ts lib/map-property.test.ts lib/search-filters.test.ts
```

- [ ] **Step 4: Device smoke** (Android already running OK)

1. Home: skeletons flash then marketable-first; Coup de cœur on featured only  
2. Terrain SOLD + sous-offre: grayscale, no CTA on detail  
3. AVAILABLE_SOON: color card, countdown badge, visit CTA visible  
4. Filter « Disponibles seulement »: excludes SOLD / UNDER_OFFER / OCCUPIED; keeps short-stay  

- [ ] **Step 5: Commit only if smoke found small fixes**; otherwise done.

---

## Self-review (plan vs spec)

| Spec item | Task |
|-----------|------|
| `ListingStatus` + drop old enums | T1 |
| Mode allow-list + `availableFrom` resolution | T3 |
| Migration map RESERVED→UNDER_OFFER on SALE | T1 SQL |
| Seed SOLD + UNDER_OFFER + OCCUPIED + AVAILABLE_SOON + featured | T2 |
| PublicProperty fields | T3 |
| Mobile helpers + filter | T4–T5 |
| Grayscale + Coup de cœur + card split + skeleton | T6–T7 |
| sortMarketableFirst | T5 |
| Detail CTA matrix | T7 |
| Non-goals (book calendar, web editors) | excluded |

No TBD placeholders; types consistent (`UNDER_OFFER`, `isFeatured`, `listingStatusLabel`).
