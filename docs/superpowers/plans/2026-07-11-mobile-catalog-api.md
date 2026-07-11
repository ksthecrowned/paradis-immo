# Mobile Catalog API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich Property API (features, listing availability, extras, media, org/agent) and wire mobile Home / Search / Discover / property detail to live data with R2 images — without removing any UI chrome.

**Architecture:** Prisma migration adds catalog fields (`listingAvailability` — **not** `availability`, which already names the AvailabilityBlock relation). Extend `PublicProperty` + `toPublic`. Mobile `mapPublicProperty` adapts API → UI `Property`; catalog screens fetch via `listProperties` / `getProperty`.

**Tech Stack:** NestJS, Prisma, Expo, Bun tests, existing `apiFetch` / `lib/properties.ts`.

## Global Constraints

- French copy only; no visual block removal (defaults / empty states inside existing UI)
- Spec: `docs/superpowers/specs/2026-07-11-mobile-catalog-api-design.md`
- Field rename vs spec: use **`listingAvailability`** + **`unavailableReason`** (Prisma conflict with `availability AvailabilityBlock[]`)
- Keep conversion / agency hubs / activity on mocks

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Enums + Property columns |
| `apps/api/prisma/migrations/…` | Migration SQL |
| `apps/api/prisma/seed.ts` | Fill enriched fields on demo props |
| `apps/api/src/properties/properties.service.ts` | include media/agent, `toPublic` |
| `apps/api/src/properties/properties.spec.ts` (or extend) | Assert public shape |
| `apps/mobile/lib/properties.ts` | Extend `PublicProperty` type |
| `apps/mobile/lib/map-property.ts` | API → UI `Property` |
| `apps/mobile/lib/map-property.test.ts` | Adapter tests |
| `apps/mobile/lib/catalog.ts` | `fetchCatalog` / `fetchCatalogProperty` helpers |
| `apps/mobile/app/(tabs)/index.tsx` | Home API list |
| `apps/mobile/app/search.tsx` | Search API |
| `apps/mobile/app/(tabs)/discover.tsx` | Discover API |
| `apps/mobile/app/property/[id]/index.tsx` | Detail API |
| `apps/mobile/app/category/[key].tsx` | If uses mocks, switch |

---

### Task 1: Prisma enums + Property columns

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: migration via `prisma migrate`

**Schema additions** (after existing Property scalars, before relations):

```prisma
enum ListingAvailability {
  AVAILABLE
  UNAVAILABLE
}

enum UnavailableReason {
  RENTED
  SOLD
  RESERVED
}

// on Property model — ADD (do not rename AvailabilityBlock relation `availability`):
  features            Json?
  listingAvailability ListingAvailability @default(AVAILABLE)
  unavailableReason   UnavailableReason?
  floor               String?
  yearBuilt           Int?
  condition           String?
  lotSize             Float?
  parkingSpaces       Int?
  orientation         String?
  landTitle           String?
  mapViews            Json?
```

- [ ] **Step 1:** Edit schema as above

- [ ] **Step 2:** Run migrate

```bash
cd apps/api && bunx prisma migrate dev --name property_catalog_fields
```

Expected: migration applied, client generated

- [ ] **Step 3:** Commit

```bash
git add apps/api/prisma
git commit -m "feat(api): add property catalog fields and listing availability"
```

---

### Task 2: Seed enriched catalog fields

**Files:** `apps/api/prisma/seed.ts`

On each demo property `update`/`create`, set:

| Property | listingAvailability | unavailableReason | features (sample) | extras |
|----------|---------------------|-------------------|-------------------|--------|
| propRentLong (Centre-ville) | UNAVAILABLE | RENTED | cuisine, wifi, clim… | floor `2e étage`, yearBuilt 2012 |
| propSale (Villa) | AVAILABLE | — | cuisine, jardin, parking… | floor `R+1`, yearBuilt 2018 |
| propShort (Tié-Tié) | UNAVAILABLE | RESERVED | wifi, jardin… | — |
| propLand | UNAVAILABLE | SOLD | parking, eau_courante | lotSize 400, landTitle |

`mapViews`: e.g. `["neighborhood","streetView"]` JSON arrays.

Use same string feature ids as mobile `PropertyFeatureId`.

- [ ] **Step 1:** Patch seed property upserts with fields above

- [ ] **Step 2:** `bun run prisma:seed` — expect success

- [ ] **Step 3:** Commit

```bash
git commit -m "feat(api): seed catalog features and listing availability"
```

---

### Task 3: PublicProperty + toPublic (media, org, agent, fields)

**Files:**
- Modify: `apps/api/src/properties/properties.service.ts`
- Modify: `apps/api/src/properties/properties.spec.ts` (add assertions if suite hits list/get)

**Extend interface:**

```ts
export interface PublicProperty {
  // …existing…
  features: string[];
  listingAvailability: 'AVAILABLE' | 'UNAVAILABLE';
  unavailableReason: 'RENTED' | 'SOLD' | 'RESERVED' | null;
  floor: string | null;
  yearBuilt: number | null;
  condition: string | null;
  lotSize: number | null;
  parkingSpaces: number | null;
  orientation: string | null;
  landTitle: string | null;
  mapViews: string[];
  media: Array<{ id: string; url: string; type: string; position: number }>;
  organization: { id: string; name: string; type: string };
  /** @deprecated alias — keep for web if needed */
  ownerOrg: { id: string; name: string; type: string };
  agent: { id: string; name: string; phone: string | null } | null;
}
```

**publicInclude:**

```ts
private publicInclude(): Prisma.PropertyInclude {
  return {
    quartier: {
      include: { arrondissement: { include: { city: true } } },
    },
    organization: {
      include: {
        members: {
          where: { role: 'AGENT' },
          take: 1,
          include: { user: true },
        },
      },
    },
    media: { orderBy: { position: 'asc' } },
  };
}
```

**toPublic:** map Json features/mapViews safely to `string[]`; set `organization` + `ownerOrg` same object; agent from `organization.members[0]?.user`; media map; listing fields.

- [ ] **Step 1:** Implement include + toPublic + interface

- [ ] **Step 2:** Manual or jest: `GET /properties?status=ACTIVE` returns media URLs and `listingAvailability`

```bash
# with API running, or jest properties.spec if it boots app
cd apps/api && bun test src/properties/properties.spec.ts
```

- [ ] **Step 3:** Commit

```bash
git commit -m "feat(api): expose catalog media, org, agent, and listing fields"
```

---

### Task 4: Mobile PublicProperty type + mapPublicProperty

**Files:**
- Modify: `apps/mobile/lib/properties.ts` — align `PublicProperty` with API
- Create: `apps/mobile/lib/map-property.ts`
- Create: `apps/mobile/lib/map-property.test.ts`

**Constant:**

```ts
/** Fallback when API has no agent — keeps AgentRow string id stable. */
export const FALLBACK_AGENT_ID = 'api-agent-fallback';
```

**mapPublicProperty** (essential logic):

```ts
export function mapPublicProperty(api: PublicProperty): Property {
  const media = [...(api.media ?? [])].sort((a, b) => a.position - b.position);
  const cover = media[0]?.url ?? '';
  const city = api.quartier.arrondissement.city.name;
  const q = api.quartier.name;
  const org = api.organization ?? api.ownerOrg;
  return {
    id: api.id,
    title: api.title,
    description: api.description,
    price: formatPriceLabel(api.price, api.currency),
    coverImage: cover,
    images: media.slice(1).map((m) => m.url),
    location: `${q}, ${city}`,
    bedrooms: api.bedrooms ?? undefined,
    bathrooms: api.bathrooms ?? undefined,
    surface: api.surface != null ? `${api.surface} m²` : undefined,
    floor: api.floor ?? undefined,
    yearBuilt: api.yearBuilt ?? undefined,
    condition: api.condition ?? undefined,
    lotSize: api.lotSize != null ? `${api.lotSize} m²` : undefined,
    parkingSpaces: api.parkingSpaces ?? undefined,
    orientation: api.orientation ?? undefined,
    landTitle: api.landTitle ?? undefined,
    mode: api.mode as PropertyMode,
    category: typeToCategory(api.type),
    features: (api.features ?? []) as PropertyFeatureId[],
    mapViews: (api.mapViews?.length
      ? api.mapViews
      : api.lat != null
        ? ['neighborhood']
        : []) as PropertyMapView[],
    agencyId: org.id,
    agentId: api.agent?.id ?? FALLBACK_AGENT_ID,
    availability: api.listingAvailability === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'AVAILABLE',
    unavailableReason: api.unavailableReason ?? undefined,
    lat: api.lat ?? 0,
    lng: api.lng ?? 0,
  };
}
```

Update UI helpers that read `property.availability` — already correct.

Fix `listProperties` unwrap: API returns `{ data, meta }` at top level via Nest interceptor — verify `apiFetch` unwrap; today:

```ts
const result = await apiFetch<{ data: PublicProperty[] }>(...);
return result.data ?? [];
```

If interceptor already unwraps to `{ data, meta }`, keep; if double-wrap, fix once in this task.

- [ ] **Step 1:** Failing tests for mapper (available + rented + media cover)

```ts
test('maps cover and unavailable', () => {
  const p = mapPublicProperty(sampleUnavailable);
  expect(p.coverImage).toContain('house');
  expect(p.availability).toBe('UNAVAILABLE');
  expect(p.unavailableReason).toBe('RENTED');
});
```

- [ ] **Step 2:** Implement until PASS

```bash
cd apps/mobile && bun test lib/map-property.test.ts
```

- [ ] **Step 3:** Commit

```bash
git commit -m "feat(mobile): map PublicProperty to UI Property catalog model"
```

---

### Task 5: catalog fetch helpers + wire Home / Search / Discover

**Files:**
- Create: `apps/mobile/lib/catalog.ts`
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/search.tsx`
- Modify: `apps/mobile/app/(tabs)/discover.tsx`
- Modify: `apps/mobile/app/category/[key].tsx` if it lists mocks

```ts
// catalog.ts
export async function fetchCatalogProperties(
  filters?: PropertyFilters,
): Promise<Property[]> {
  const rows = await listProperties(filters);
  return rows.map(mapPublicProperty);
}

export async function fetchCatalogProperty(id: string): Promise<Property> {
  const row = await getProperty(id);
  return mapPublicProperty(row);
}
```

**Home pattern:**

```ts
const [items, setItems] = useState<Property[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const load = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    setItems(await fetchCatalogProperties({ limit: 50 }));
  } catch (e) {
    setError(getErrorMessage(e, 'Impossible de charger les biens'));
  } finally {
    setLoading(false);
  }
}, []);

useFocusEffect(useCallback(() => { void load(); }, [load]));
```

Keep AgencyChip row, categories, cards — filter client-side by category/agency as today. On error show banner/Feedback, keep chrome.

**Do not** delete AgencyChip if agency filter yields 0 — empty list under chips is fine.

- [ ] **Step 1:** Implement catalog.ts + Home
- [ ] **Step 2:** Search + Discover (+ category)
- [ ] **Step 3:** Smoke device — 4 seed cards with R2 images
- [ ] **Step 4:** Commit

```bash
git commit -m "feat(mobile): load Home Search Discover catalog from API"
```

---

### Task 6: Property detail (+ gallery consumers) from API

**Files:**
- Modify: `apps/mobile/app/property/[id]/index.tsx`
- Modify other screens that `getPropertyById` for **catalog** navigation only (sale-inquiry / payment may stay mock until conversion pass — if they break because id is UUID, load via `fetchCatalogProperty` for display summary only)

Detail:

```ts
const [property, setProperty] = useState<Property | null>(null);
// fetch fetchCatalogProperty(id) on focus
// gallery: prefer property.images/coverImage URIs over getPropertyGallery mock rotation
```

Update `getPropertyGallery` usage: if `coverImage` is http(s), use URI array; else keep local asset fallback (no UI removal).

```ts
export function resolveGallery(property: Property): ImageSourcePropType[] {
  if (property.coverImage.startsWith('http')) {
    return [
      { uri: property.coverImage },
      ...(property.images ?? []).map((uri) => ({ uri })),
    ];
  }
  return getPropertyGallery(property); // legacy mock assets
}
```

- [ ] **Step 1:** Detail fetch + gallery resolve
- [ ] **Step 2:** Smoke Indispo property + available villa
- [ ] **Step 3:** Commit

```bash
git commit -m "feat(mobile): load property detail and R2 gallery from API"
```

---

### Task 7: Acceptance + search-filters availability

**Files:** `apps/mobile/lib/search-filters.ts` — ensure `availableOnly` uses `property.availability` (already); agency filter uses `agencyId` (= org id).

- [ ] **Step 1:** Checklist from spec (4 listings, R2, Indispo, org name, no missing chrome, error path)
- [ ] **Step 2:** `cd apps/mobile && bun test lib/map-property.test.ts lib/search-filters.test.ts lib/property-availability.test.ts`
- [ ] **Step 3:** Final polish commit if needed

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Prisma fields (as `listingAvailability`) | 1 |
| Seed enrichment | 2 |
| media / org / agent in PublicProperty | 3 |
| Adapter + defaults | 4 |
| Home Search Discover | 5 |
| Detail + gallery | 6 |
| No UI removal / acceptance | 5–7 |
| Conversion / agency hubs untouched | Global |

**Self-review note:** Spec wrote `availability` on Property — plan correctly uses `listingAvailability` due to existing relation name; mobile UI type keeps `availability` via mapper.
