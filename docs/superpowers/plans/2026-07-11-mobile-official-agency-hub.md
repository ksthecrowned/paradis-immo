# Mobile Official Agency Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add official « Agence Paradis Immo » (pinned, Officiel badge, brand tint), profile-style agency hub with ratings + Avis tab, and property trust chips that name the managing agency.

**Architecture:** Extend `mock-agencies` with `isOfficial` / ratings / reviews; sort official first. Redesign `agency/[id]` identity card + 3 tabs. Small updates to `AgencyChip` and property detail trust copy.

**Tech Stack:** Expo Router, React Native, TypeScript, Bun, existing `SegmentTabs` / theme `#7065F0`.

## Global Constraints

- French UI copy only
- Light theme; primary `#7065F0` for official agency
- UI mocks only; no Nest API / no review submission
- No dark mode; no Historique tab; no passes C / B / D
- Touch targets ≥ 44pt
- Spec: `docs/superpowers/specs/2026-07-11-mobile-official-agency-hub-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/mobile/lib/mock-agencies.ts` | Official agency, ratings fields, reviews, sorted `listAgencies` |
| `apps/mobile/lib/mock-agencies.test.ts` | Official-first + reviews tests |
| `apps/mobile/lib/mock-properties.ts` | Assign ≥1 property to official agency |
| `apps/mobile/components/agency/AgencyChip.tsx` | Officiel pill |
| `apps/mobile/components/agency/StarRating.tsx` | Reusable 1–5 star row |
| `apps/mobile/app/agency/[id].tsx` | Profile hub + Avis tab |
| `apps/mobile/app/property/[id]/index.tsx` | Trust chip agency shortName |

Home / Filters already call `listAgencies()` — sorting alone updates discovery order.

---

### Task 1: Mock official agency + reviews

**Files:**
- Modify: `apps/mobile/lib/mock-agencies.ts`
- Modify: `apps/mobile/lib/mock-agencies.test.ts`
- Modify: `apps/mobile/lib/mock-properties.ts`

**Interfaces:**
- Produces:
  - `Agency.isOfficial`, `rating`, `reviewCount`, `dealSuccessPercent`
  - `AgencyReview` + `MOCK_AGENCY_REVIEWS` + `listAgencyReviews(agencyId: string): AgencyReview[]`
  - `listAgencies()` returns official first
  - `isOfficialAgency(id: string): boolean`
  - Official id: `ag-paradis-immo`

- [ ] **Step 1: Extend failing tests**

```ts
// append to mock-agencies.test.ts
test('lists official agency first', () => {
  const list = listAgencies();
  expect(list[0]?.id).toBe('ag-paradis-immo');
  expect(list[0]?.isOfficial).toBe(true);
});

test('listAgencyReviews returns reviews for agency', () => {
  const reviews = listAgencyReviews('ag-paradis-immo');
  expect(reviews.length).toBeGreaterThan(0);
  expect(reviews.every((r) => r.agencyId === 'ag-paradis-immo')).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/mobile && bun test lib/mock-agencies.test.ts`  
Expected: FAIL (fields / exports missing)

- [ ] **Step 3: Implement catalog**

Add official agency first in array (or sort in `listAgencies`):

```ts
{
  id: 'ag-paradis-immo',
  name: 'Agence Paradis Immo',
  shortName: 'Paradis Immo',
  city: 'Pointe-Noire',
  logoColor: '#7065F0',
  tagline: 'L’agence officielle de la plateforme',
  address: 'Centre-ville, Pointe-Noire',
  phone: '+242 06 500 00 00',
  verified: true,
  foundedYear: 2012,
  isOfficial: true,
  rating: 4.9,
  reviewCount: 128,
  dealSuccessPercent: 94,
}
```

Add `isOfficial: false` + rating fields to other agencies. Add ≥2 agents `ag-paradis-immo-1/2`. Add `MOCK_AGENCY_REVIEWS` (≥2 for official, ≥1 for another).

```ts
export function listAgencies(): Agency[] {
  return [...MOCK_AGENCIES].sort(
    (a, b) => Number(b.isOfficial) - Number(a.isOfficial),
  );
}

export function listAgencyReviews(agencyId: string): AgencyReview[] {
  return MOCK_AGENCY_REVIEWS.filter((r) => r.agencyId === agencyId);
}

export function isOfficialAgency(id: string): boolean {
  return getAgency(id)?.isOfficial === true;
}
```

- [ ] **Step 4: Assign a property**

Set property `1` (or another) to `agencyId: 'ag-paradis-immo'`, `agentId: 'ag-paradis-immo-1'`.

- [ ] **Step 5: Run — expect PASS**

Run: `cd apps/mobile && bun test lib/mock-agencies.test.ts`

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/mock-agencies.ts \
  apps/mobile/lib/mock-agencies.test.ts \
  apps/mobile/lib/mock-properties.ts
git commit -m "feat(mobile): add official Paradis Immo agency mocks and reviews"
```

---

### Task 2: StarRating + AgencyChip Officiel

**Files:**
- Create: `apps/mobile/components/agency/StarRating.tsx`
- Modify: `apps/mobile/components/agency/AgencyChip.tsx`

**Interfaces:**
- `StarRating({ rating, size? }: { rating: number; size?: number })` — fills stars for floor(rating); half optional YAGNI — use full/empty only, show numeric beside caller
- `AgencyChip` shows small « Officiel » text when `agency.isOfficial`

- [ ] **Step 1: Implement StarRating**

```tsx
import { colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

export function StarRating({
  rating,
  size = 14,
}: {
  rating: number;
  size?: number;
}): React.JSX.Element {
  const filled = Math.round(Math.min(5, Math.max(0, rating)));
  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= filled ? 'star' : 'star-outline'}
          size={size}
          color={n <= filled ? '#F5B301' : colors.muted}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
```

- [ ] **Step 2: AgencyChip Officiel**

After label, if `agency.isOfficial`:

```tsx
<View style={styles.official}>
  <Text style={styles.officialText}>Officiel</Text>
</View>
```

Styles: primaryMuted bg, primary text, tiny pill.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/components/agency/StarRating.tsx \
  apps/mobile/components/agency/AgencyChip.tsx
git commit -m "feat(mobile): add StarRating and Officiel agency chip"
```

---

### Task 3: Redesign agency hub + Avis tab

**Files:**
- Modify: `apps/mobile/app/agency/[id].tsx`

**Interfaces:**
- Consumes: `StarRating`, `listAgencyReviews`, Agency rating fields
- Tabs keys: `properties` | `agents` | `reviews`

- [ ] **Step 1: Identity card**

Replace sparse header with surface card containing:
- Logo + name
- Row: `StarRating` + `rating.toFixed(1)` + `· {reviewCount} avis`
- Badges: Officiel if `isOfficial`; « Top » if `rating >= 4.8`
- Address / phone / tagline rows (existing)
- Deal success: label « Succès transactions » + track + fill width `${dealSuccessPercent}%`

- [ ] **Step 2: Third tab Avis**

```ts
const TABS = [
  { key: 'properties', label: 'Biens' },
  { key: 'agents', label: 'Agents' },
  { key: 'reviews', label: 'Avis' },
] as const;
```

When `segment === 'reviews'`, FlatList of `listAgencyReviews(agency.id)`:
- Initials avatar, `propertyTitle`, `body` (2 lines), `StarRating`, `createdLabel`
- Empty: « Aucun avis pour le moment »

Keep Biens/Agents behavior (agent filter).

- [ ] **Step 3: Manual smoke** — open official from Home → all 3 tabs

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/agency/[id].tsx
git commit -m "feat(mobile): profile-style agency hub with reviews tab"
```

---

### Task 4: Property trust chip

**Files:**
- Modify: `apps/mobile/app/property/[id]/index.tsx`

**Interfaces:**
- Consumes: `getAgency(property.agencyId)`

- [ ] **Step 1: Replace copy**

```tsx
import { getAgency } from '@/lib/mock-agencies';
// inside render, when property exists:
const agency = getAgency(property.agencyId);
// ...
<Text style={styles.verifiedText}>
  Annonce vérifiée · {agency?.shortName ?? 'Agence'}
</Text>
```

- [ ] **Step 2: Smoke** — property 1 (official) shows « Paradis Immo »; other agency shows their shortName

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/property/[id]/index.tsx
git commit -m "feat(mobile): trust chip names managing agency"
```

---

### Task 5: Acceptance

- [ ] **Step 1:** `cd apps/mobile && bun test lib/mock-agencies.test.ts` → PASS  
- [ ] **Step 2:** Checklist from spec (Home pin, Officiel, hub card, 3 tabs, trust chip, FR/`#7065F0`)  
- [ ] **Step 3:** Fix only if checklist fails  

---

## Spec coverage

| Spec | Task |
|------|------|
| Official agency + sort | 1 |
| Ratings / reviews mocks | 1 |
| AgencyChip Officiel | 2 |
| Hub profile + Avis | 3 |
| Trust chip | 4 |
| Acceptance | 5 |

## Placeholder scan

None.
