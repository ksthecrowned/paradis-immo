# Mobile Listing Availability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show Dispo/Indispo on marketplace: unavailable listings stay visible with a card border, detail badge + reason, hidden conversion CTAs, and an « Disponibles seulement » filter.

**Architecture:** Add `availability` + `unavailableReason` on `Property` mocks; helpers for labels; wire `PropertyCard`, detail footer, and `SearchFilters`.

**Tech Stack:** Expo, React Native, TypeScript, Bun, existing theme / StatusBadge patterns.

## Global Constraints

- French copy only
- Card: border only for Indispo — no Dispo/Indispo badge on card
- Detail: badge `Indispo · Loué|Vendu|Réservé`; hide conversion CTAs
- Keep mode badge, share, favorites, ⋯
- UI mocks; no Prisma/API
- Spec: `docs/superpowers/specs/2026-07-11-mobile-listing-availability-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/mobile/types/property.ts` | Types + helpers |
| `apps/mobile/lib/mock-properties.ts` | Assign availability on mocks |
| `apps/mobile/lib/search-filters.ts` | `availableOnly` |
| `apps/mobile/lib/search-filters.test.ts` | Filter tests |
| `apps/mobile/components/property/card.tsx` | Indispo border |
| `apps/mobile/app/property/[id]/index.tsx` | Badge + footer banner |
| `apps/mobile/app/filters.tsx` | Toggle disponibles |

---

### Task 1: Types, helpers, mocks

**Files:**
- Modify: `apps/mobile/types/property.ts`
- Modify: `apps/mobile/lib/mock-properties.ts`
- Create or extend: small test in `apps/mobile/lib/property-availability.test.ts` (or next to search-filters)

**Interfaces:**
```ts
export type PropertyAvailability = 'AVAILABLE' | 'UNAVAILABLE';
export type UnavailableReason = 'RENTED' | 'SOLD' | 'RESERVED';
// Property.availability: PropertyAvailability
// Property.unavailableReason?: UnavailableReason
export function isPropertyAvailable(p: Property): boolean
export function unavailableReasonLabel(r: UnavailableReason): string
export function propertyAvailabilityBadgeLabel(p: Property): string | null
```

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, test } from 'bun:test';
import {
  propertyAvailabilityBadgeLabel,
  unavailableReasonLabel,
  type Property,
} from '@/types/property';

const base = {
  id: 'x',
  title: 'T',
  description: '',
  price: '1',
  coverImage: '',
  mode: 'SALE' as const,
  lat: 0,
  lng: 0,
  agencyId: 'a',
  agentId: 'b',
  availability: 'AVAILABLE' as const,
};

test('badge null when available', () => {
  expect(propertyAvailabilityBadgeLabel(base as Property)).toBeNull();
});

test('badge for rented', () => {
  expect(
    propertyAvailabilityBadgeLabel({
      ...base,
      mode: 'RENT_LONG',
      availability: 'UNAVAILABLE',
      unavailableReason: 'RENTED',
    } as Property),
  ).toBe('Indispo · Loué');
});

test('reason labels', () => {
  expect(unavailableReasonLabel('SOLD')).toBe('Vendu');
});
```

- [ ] **Step 2: Run — FAIL** then implement types/helpers

Default: if `availability` omitted treat as AVAILABLE in helpers for safety; mocks always set field.

- [ ] **Step 3: Mocks**

- id `2` RENT_LONG → UNAVAILABLE RENTED  
- id `4` SALE land → UNAVAILABLE SOLD  
- id `3` RENT_SHORT → UNAVAILABLE RESERVED  
- id `1` → AVAILABLE  

- [ ] **Step 4: Tests PASS + commit**

```bash
git commit -m "feat(mobile): add property availability types and mocks"
```

---

### Task 2: SearchFilters availableOnly

**Files:** `search-filters.ts`, `search-filters.test.ts`, `filters.tsx`

- [ ] Add `availableOnly: boolean` to filters (default false)
- [ ] `filterProperties`: if `availableOnly`, keep only `availability !== 'UNAVAILABLE'` (treat missing as available)
- [ ] count + params `available=1`
- [ ] Filters UI: chip/toggle « Disponibles seulement »
- [ ] Tests + commit `feat(mobile): filter available listings only`

---

### Task 3: PropertyCard border

**Files:** `card.tsx`

- [ ] If unavailable: `[styles.card, styles.cardUnavailable]` with `borderWidth: 2`, `borderColor: colors.danger`
- [ ] No availability badge text
- [ ] Commit `feat(mobile): mark unavailable properties with card border`

---

### Task 4: Property detail badge + footer

**Files:** `property/[id]/index.tsx`

- [ ] Import helpers; show pill in trust row when badge label non-null
- [ ] If unavailable: hide primary CTA; show banner text « Ce bien n’est plus disponible » + reason; keep ⋯ button
- [ ] If available: existing CTA row
- [ ] Commit `feat(mobile): show indispo badge and hide conversion CTAs`

---

### Task 5: Acceptance

- [ ] `bun test` for availability + search-filters  
- [ ] Manual checklist from spec  
- [ ] Fix if needed  

---

## Spec coverage

| Spec | Task |
|------|------|
| Types + mocks | 1 |
| Filter disponibles | 2 |
| Card border | 3 |
| Detail badge + CTA | 4 |
| Acceptance | 5 |

## Placeholder scan

None.
