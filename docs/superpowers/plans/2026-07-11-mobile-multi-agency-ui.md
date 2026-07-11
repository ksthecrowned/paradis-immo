# Mobile Multi-Agency UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship UI-first multi-agency attribution (chips, agent row, search filter, home row), a public `/agency/[id]` hub (Biens | Agents), and conversion copy that names agency ± agent — matching `docs/superpowers/specs/2026-07-11-mobile-multi-agency-ui-design.md`.

**Architecture:** Mock `Agency` / `Agent` catalog linked from `Property.agencyId` / `agentId`. Shared `AgencyChip` + `AgentRow`. Hub filters Biens in-place when an agent is selected (no `/agent/[id]`). SearchFilters gains `agencyIds`.

**Tech Stack:** Expo Router ~57, React Native, TypeScript, Bun, existing `theme.ts` / `SegmentTabs` / `PropertyCard`.

## Global Constraints

- French UI copy only
- Brand primary `#7065F0`; agency `logoColor` only for avatar/chip tint
- UI mocks allowed; no Nest / Prisma changes
- No `/agent/[id]`; no per-agency app chrome theming
- Touch targets ≥ 44pt; `accessibilityLabel` on icon-only / chips
- Chip tap must not trigger parent card navigation
- Do not redesign onboarding, auth, or Activity hub (Activity agency meta optional — skip this pass)

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/mobile/types/property.ts` | Add `agencyId` / `agentId` on `Property` |
| `apps/mobile/lib/mock-agencies.ts` | Agency/agent catalog + helpers |
| `apps/mobile/lib/mock-agencies.test.ts` | Bun tests for helpers / filter by agency |
| `apps/mobile/lib/mock-properties.ts` | Assign agency/agent ids; property-by-agency helpers |
| `apps/mobile/lib/search-filters.ts` | `agencyIds` in filters + serialize |
| `apps/mobile/lib/search-filters.test.ts` | Filter + count tests |
| `apps/mobile/components/agency/AgencyChip.tsx` | Compact agency chip |
| `apps/mobile/components/agency/AgentRow.tsx` | Agent · agency row |
| `apps/mobile/app/agency/[id].tsx` | Agency hub |
| `apps/mobile/app/_layout.tsx` | Register `agency/[id]` |
| `apps/mobile/app/(tabs)/index.tsx` | Home agencies row |
| `apps/mobile/components/property/card.tsx` | Show `AgencyChip` |
| `apps/mobile/app/filters.tsx` | Agency multi-select |
| `apps/mobile/app/property/[id]/index.tsx` | `AgentRow` + Voir l’agence |
| `apps/mobile/app/property/[id]/visit.tsx` | Attribution recap |
| `apps/mobile/app/payment/[id].tsx` | Cash copy with agency |
| `apps/mobile/components/property/PropertySummaryCard.tsx` | Optional agency line |
| `apps/mobile/app/property/[id]/book.tsx` | Uses summary (inherits) |
| `apps/mobile/app/property/[id]/sale-inquiry.tsx` | Uses summary (inherits) |

---

### Task 1: Mock agencies + property attribution

**Files:**
- Create: `apps/mobile/lib/mock-agencies.ts`
- Create: `apps/mobile/lib/mock-agencies.test.ts`
- Modify: `apps/mobile/types/property.ts`
- Modify: `apps/mobile/lib/mock-properties.ts`

**Interfaces:**
- Consumes: existing `Property`, `MOCK_PROPERTIES`
- Produces:
  - `export type Agency = { id: string; name: string; shortName: string; city: string; logoColor: string }`
  - `export type Agent = { id: string; agencyId: string; displayName: string; initials: string }`
  - `listAgencies(): Agency[]`
  - `getAgency(id: string): Agency | undefined`
  - `listAgentsByAgency(agencyId: string): Agent[]`
  - `getAgent(id: string): Agent | undefined`
  - `listPropertiesByAgency(agencyId: string): Property[]`
  - `listPropertiesByAgent(agentId: string): Property[]`
  - `Property.agencyId: string` and `Property.agentId: string` (required on mocks)

- [ ] **Step 1: Write failing tests**

```ts
// apps/mobile/lib/mock-agencies.test.ts
import { describe, expect, test } from 'bun:test';
import {
  getAgency,
  getAgent,
  listAgencies,
  listAgentsByAgency,
  listPropertiesByAgency,
  listPropertiesByAgent,
} from './mock-agencies';

describe('mock agencies', () => {
  test('lists at least 3 agencies', () => {
    expect(listAgencies().length).toBeGreaterThanOrEqual(3);
  });

  test('each agency has at least 2 agents', () => {
    for (const agency of listAgencies()) {
      expect(listAgentsByAgency(agency.id).length).toBeGreaterThanOrEqual(2);
    }
  });

  test('properties resolve to known agency and agent', () => {
    const props = listPropertiesByAgency(listAgencies()[0]!.id);
    expect(props.length).toBeGreaterThan(0);
    const agent = getAgent(props[0]!.agentId);
    expect(agent?.agencyId).toBe(props[0]!.agencyId);
    expect(getAgency(props[0]!.agencyId)).toBeDefined();
  });

  test('listPropertiesByAgent returns only that agent', () => {
    const agent = listAgentsByAgency(listAgencies()[0]!.id)[0]!;
    const props = listPropertiesByAgent(agent.id);
    expect(props.every((p) => p.agentId === agent.id)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/mobile && bun test lib/mock-agencies.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Extend Property type**

In `apps/mobile/types/property.ts`, add to `Property`:

```ts
  /** Managing agency (Organization). */
  agencyId: string;
  /** Referring agent (OrganizationMember). */
  agentId: string;
```

- [ ] **Step 4: Implement `mock-agencies.ts`**

Create ≥ 3 Pointe-Noire agencies (e.g. Côte Sauvage, Habitat PN, Mongo Immo) with distinct `logoColor` (not primary purple for all — use navy/teal/amber tints). ≥ 2 agents each.

Export helpers listed above. Implement `listPropertiesByAgency` / `listPropertiesByAgent` by importing `MOCK_PROPERTIES` from `./mock-properties` (watch circular imports: prefer putting property list helpers in `mock-properties.ts` and re-export from `mock-agencies.ts`, OR keep helpers in `mock-agencies.ts` importing properties only).

Recommended: put `listPropertiesByAgency` / `listPropertiesByAgent` in `mock-properties.ts`; re-export from `mock-agencies.ts` for a single import surface in tests.

- [ ] **Step 5: Assign ids on every mock property**

Update each entry in `MOCK_PROPERTIES` with valid `agencyId` + `agentId` spanning multiple agencies.

- [ ] **Step 6: Run tests — expect PASS**

Run: `cd apps/mobile && bun test lib/mock-agencies.test.ts`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/types/property.ts \
  apps/mobile/lib/mock-agencies.ts \
  apps/mobile/lib/mock-agencies.test.ts \
  apps/mobile/lib/mock-properties.ts
git commit -m "feat(mobile): add mock agencies and property attribution"
```

---

### Task 2: SearchFilters agencyIds

**Files:**
- Modify: `apps/mobile/lib/search-filters.ts`
- Create: `apps/mobile/lib/search-filters.test.ts`

**Interfaces:**
- Consumes: `Property.agencyId`
- Produces: `SearchFilters.agencyIds: string[]`; updated `DEFAULT_SEARCH_FILTERS`, `countActiveFilters`, `filterProperties`, `filtersToParams`, `paramsToFilters` (param key `agencies` comma-separated)

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, test } from 'bun:test';
import type { Property } from '@/types/property';
import {
  countActiveFilters,
  DEFAULT_SEARCH_FILTERS,
  filterProperties,
  filtersToParams,
  paramsToFilters,
} from './search-filters';

const sample: Property[] = [
  {
    id: 'a',
    title: 'A',
    description: '',
    price: '1',
    coverImage: '',
    mode: 'SALE',
    lat: 0,
    lng: 0,
    agencyId: 'ag1',
    agentId: 'ag1-1',
  },
  {
    id: 'b',
    title: 'B',
    description: '',
    price: '1',
    coverImage: '',
    mode: 'SALE',
    lat: 0,
    lng: 0,
    agencyId: 'ag2',
    agentId: 'ag2-1',
  },
];

describe('agencyIds filter', () => {
  test('empty agencyIds keeps all', () => {
    expect(
      filterProperties(sample, { ...DEFAULT_SEARCH_FILTERS, agencyIds: [] }),
    ).toHaveLength(2);
  });

  test('filters to selected agencies', () => {
    const out = filterProperties(sample, {
      ...DEFAULT_SEARCH_FILTERS,
      agencyIds: ['ag1'],
    });
    expect(out.map((p) => p.id)).toEqual(['a']);
  });

  test('countActiveFilters counts agency selection as 1', () => {
    expect(
      countActiveFilters({ ...DEFAULT_SEARCH_FILTERS, agencyIds: ['ag1', 'ag2'] }),
    ).toBe(1);
  });

  test('round-trips agencies param', () => {
    const params = filtersToParams({
      ...DEFAULT_SEARCH_FILTERS,
      agencyIds: ['ag1', 'ag2'],
    });
    expect(params.agencies).toBe('ag1,ag2');
    expect(paramsToFilters(params).agencyIds).toEqual(['ag1', 'ag2']);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/mobile && bun test lib/search-filters.test.ts`  
Expected: FAIL (agencyIds missing)

- [ ] **Step 3: Implement**

```ts
export type SearchFilters = {
  q: string;
  mode: PropertyMode | 'ALL';
  minBedrooms: number | null;
  features: PropertyFeatureId[];
  agencyIds: string[];
};

export const DEFAULT_SEARCH_FILTERS: SearchFilters = {
  q: '',
  mode: 'ALL',
  minBedrooms: null,
  features: [],
  agencyIds: [],
};
```

In `filterProperties`, after features check:

```ts
if (filters.agencyIds.length > 0 && !filters.agencyIds.includes(property.agencyId)) {
  return false;
}
```

In `countActiveFilters`: `if (filters.agencyIds.length > 0) count += 1;`

Serialize `agencies` join/split like `features`.

- [ ] **Step 4: Run — expect PASS**

Run: `cd apps/mobile && bun test lib/search-filters.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/search-filters.ts apps/mobile/lib/search-filters.test.ts
git commit -m "feat(mobile): filter search by agency ids"
```

---

### Task 3: AgencyChip + AgentRow

**Files:**
- Create: `apps/mobile/components/agency/AgencyChip.tsx`
- Create: `apps/mobile/components/agency/AgentRow.tsx`

**Interfaces:**
- Consumes: `Agency`, `Agent`, `getAgency`, `colors`, `radii`
- Produces:
  - `AgencyChip({ agencyId, onPress? })` — looks up agency; minHeight 44; tap default `router.push(/agency/${id})`
  - `AgentRow({ agentId, showAgencyLink?: boolean, onPressAgency? })` — avatar initials + « Name · Agency »

- [ ] **Step 1: Implement `AgencyChip.tsx`**

```tsx
import { colors, radii } from '@/constants/theme';
import { getAgency } from '@/lib/mock-agencies';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export function AgencyChip({
  agencyId,
  onPress,
}: {
  agencyId: string;
  onPress?: () => void;
}): React.JSX.Element | null {
  const agency = getAgency(agencyId);
  if (!agency) return null;

  const handlePress = (): void => {
    if (onPress) {
      onPress();
      return;
    }
    router.push(`/agency/${agency.id}`);
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.chip}
      accessibilityRole="button"
      accessibilityLabel={`Agence ${agency.name}`}
    >
      <View style={[styles.dot, { backgroundColor: agency.logoColor }]}>
        <Text style={styles.dotText}>{agency.shortName.slice(0, 1)}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {agency.shortName}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotText: { fontSize: 11, fontWeight: '800', color: colors.surface },
  label: { fontSize: 12, fontWeight: '700', color: colors.ink, maxWidth: 140 },
});
```

- [ ] **Step 2: Implement `AgentRow.tsx`**

Show initials circle (`logoColor` from agency), `displayName`, muted `· {agency.shortName}`. If `showAgencyLink`, trailing text button « Voir l’agence » calling `onPressAgency` or `router.push`.

- [ ] **Step 3: Typecheck touched files**

Run: `cd apps/mobile && bunx tsc --noEmit`  
Expected: no errors from new components (ignore existing TS5101 baseUrl deprecation if present)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/components/agency/AgencyChip.tsx \
  apps/mobile/components/agency/AgentRow.tsx
git commit -m "feat(mobile): add AgencyChip and AgentRow"
```

---

### Task 4: Agency hub screen + stack

**Files:**
- Create: `apps/mobile/app/agency/[id].tsx`
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `getAgency`, `listAgentsByAgency`, `listPropertiesByAgency`, `listPropertiesByAgent`, `SegmentTabs`, `PropertyCard`, `AgentRow`, `CircleIconButton`
- Produces: route `/agency/[id]` public

- [ ] **Step 1: Register stack screen**

```tsx
<Stack.Screen
  name="agency/[id]"
  options={{
    headerShown: false,
    animation: 'slide_from_right',
  }}
/>
```

- [ ] **Step 2: Implement hub**

State: `segment: 'properties' | 'agents'`, `selectedAgentId: string | null`.

- Missing agency → empty « Agence introuvable » + back
- Header: tint avatar, name, city, « N biens »
- `SegmentTabs` labels Biens | Agents
- When `selectedAgentId` set, show dismiss chip « Agent: {name} ✕ » that clears filter; Biens list uses `listPropertiesByAgent`
- Agents tab: `AgentRow` press sets `selectedAgentId` and switches segment to `properties`
- Biens: `PropertyCard` → `/property/${id}`

- [ ] **Step 3: Manual smoke** — open `/agency/<id>` from a known mock id

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/agency/[id].tsx apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add public agency hub screen"
```

---

### Task 5: Home row + PropertyCard chip

**Files:**
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/components/property/card.tsx`

**Interfaces:**
- Consumes: `listAgencies`, `AgencyChip`
- Produces: Home « Agences » row; card chip with isolated press

- [ ] **Step 1: Home header — agencies row**

Below category chips in `ListHeaderComponent`, add:

```tsx
<Text style={styles.sectionLabel}>Agences</Text>
<ScrollView horizontal showsHorizontalScrollIndicator={false}>
  {listAgencies().map((agency) => (
    <AgencyChip key={agency.id} agencyId={agency.id} />
  ))}
</ScrollView>
```

(Use existing spacing/styles; add `sectionLabel` if missing.)

- [ ] **Step 2: PropertyCard — AgencyChip**

Import `AgencyChip`. Place under title (or above price). Wrap chip so card `onPress` does not fire:

```tsx
<Pressable onPress={(e) => e.stopPropagation?.()}>
  <AgencyChip agencyId={property.agencyId} />
</Pressable>
```

On RN, prefer nesting: outer card Pressable, inner AgencyChip Pressable (RN usually gives inner priority). Verify on Android device.

- [ ] **Step 3: Manual smoke** — Home row + card chip → hub

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/(tabs)/index.tsx apps/mobile/components/property/card.tsx
git commit -m "feat(mobile): show agencies on home and property cards"
```

---

### Task 6: Filters UI for agencies

**Files:**
- Modify: `apps/mobile/app/filters.tsx`

**Interfaces:**
- Consumes: `listAgencies`, `SearchFilters.agencyIds`
- Produces: multi-select agency section; reset/apply include `agencyIds`

- [ ] **Step 1: State + reset/apply**

```ts
const [agencyIds, setAgencyIds] = useState<string[]>(initial.agencyIds);

const toggleAgency = (id: string): void => {
  setAgencyIds((current) =>
    current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
  );
};

// handleReset: setAgencyIds([])
// handleApply next: { ..., agencyIds }
```

- [ ] **Step 2: UI section « Agence »**

Horizontal wrap of chips (same visual language as feature chips). Active = primary fill.

- [ ] **Step 3: Manual smoke** — filter one agency → search list shrinks

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/filters.tsx
git commit -m "feat(mobile): add agency multi-select to filters"
```

---

### Task 7: Property detail + conversion attribution

**Files:**
- Modify: `apps/mobile/app/property/[id]/index.tsx`
- Modify: `apps/mobile/app/property/[id]/visit.tsx`
- Modify: `apps/mobile/app/payment/[id].tsx`
- Modify: `apps/mobile/components/property/PropertySummaryCard.tsx`

**Interfaces:**
- Consumes: `AgentRow`, `getAgency`, `getAgent`
- Produces: detail attribution; visit recap; cash payment copy; summary agency line

- [ ] **Step 1: Property detail**

Below price block, render:

```tsx
<AgentRow
  agentId={property.agentId}
  showAgencyLink
  onPressAgency={() => router.push(`/agency/${property.agencyId}`)}
/>
```

- [ ] **Step 2: PropertySummaryCard**

Under location, add muted line with agency `shortName` via `getAgency(property.agencyId)` (covers book + sale-inquiry).

- [ ] **Step 3: Visit screen**

After `PropertySummaryCard`, add:

```tsx
<Text style={styles.attribution}>
  Visite avec {agent?.displayName ?? 'un agent'} · {agency?.shortName ?? 'Agence'}
</Text>
```

- [ ] **Step 4: Payment cash copy**

Replace Paradis Immo-only cash text with:

```tsx
{`Payez en espèces auprès d’un agent de ${agency?.name ?? 'l’agence'}${
  agent ? ` (${agent.displayName})` : ''
}. Présentez cette référence de paiement.`}
```

Resolve agency/agent from `getPropertyById(session.propertyId)`.

- [ ] **Step 5: Manual smoke** — SALE property detail → hub; visit + cash payment strings

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/app/property/[id]/index.tsx \
  apps/mobile/app/property/[id]/visit.tsx \
  apps/mobile/app/payment/[id].tsx \
  apps/mobile/components/property/PropertySummaryCard.tsx
git commit -m "feat(mobile): attribute agency and agent on detail and conversion"
```

---

### Task 8: Acceptance pass

**Files:** none (verification)

- [ ] **Step 1: Unit tests**

Run: `cd apps/mobile && bun test lib/mock-agencies.test.ts lib/search-filters.test.ts`  
Expected: PASS

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && bunx tsc --noEmit`  
Expected: PASS aside from known `baseUrl` deprecation if any

- [ ] **Step 3: Manual checklist (from spec)**

- [ ] Home agency row → hub Biens | Agents  
- [ ] Card / detail → hub  
- [ ] Filters multi-agency  
- [ ] Detail AgentRow  
- [ ] Visit + cash name agency (± agent)  
- [ ] Hub agent tap filters Biens in-place  
- [ ] Missing agency empty state  
- [ ] FR + `#7065F0` + mocks only  

- [ ] **Step 4: Fix only if checklist fails**; commit fixes separately if needed

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Agency/Agent mocks + Property ids | 1 |
| Search `agencyIds` | 2, 6 |
| AgencyChip / AgentRow | 3 |
| `/agency/[id]` Biens \| Agents + agent filter | 4 |
| Home row + card chip | 5 |
| Detail + conversion attribution | 7 |
| Acceptance | 8 |
| No `/agent/[id]`, no API | All (constraints) |

## Placeholder scan

No TBD / “implement later” left in tasks.
