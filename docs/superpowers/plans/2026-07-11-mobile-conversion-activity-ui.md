# Mobile Conversion + Activity UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship UI-first conversion screens (visit, short-stay book, sale inquiry, payment) and a 5-segment Activity hub with real OTP gates and mock data, matching the current property-detail visual language.

**Architecture:** Linear Expo Router screens under `property/[id]/` plus `payment/[id]`. Shared UI primitives (`PropertySummaryCard`, `StatusBadge`, `SegmentTabs`, `SuccessScreen`). Mock layer in `lib/mock-*.ts` shaped like existing API libs. Auth via `ensureAuthenticated` + `returnTo` (no `/users/me` hard dependency on these screens for the UI pass).

**Tech Stack:** Expo Router ~57, React Native, TypeScript, Bun, existing `theme.ts` / `CircleIconButton` / `auth-guard.ts`.

## Global Constraints

- French UI copy only
- Brand primary `#7065F0` from `apps/mobile/constants/theme.ts`
- UI mocks allowed; do not require live Nest API for these flows
- Real OTP gate before visit / book / sale-inquiry / payment / activity
- Touch targets ≥ 44pt; `accessibilityLabel` on icon-only controls
- Floating full-width primary CTA style consistent with `property/[id]/index.tsx`
- Do not redesign home, discover, search, gallery, or immersive map variants
- No Prisma / API schema changes in this plan

## File map

| File | Responsibility |
|------|----------------|
| `apps/mobile/components/ui/StatusBadge.tsx` | Status pill |
| `apps/mobile/components/ui/SegmentTabs.tsx` | Horizontal segment control |
| `apps/mobile/components/ui/SuccessScreen.tsx` | Full-screen success |
| `apps/mobile/components/property/PropertySummaryCard.tsx` | Property strip for tunnel screens |
| `apps/mobile/lib/mock-conversion.ts` | Mock slots, booking quote, payment session, sale submit |
| `apps/mobile/lib/mock-activity.ts` | Mock activity rows for 5 segments |
| `apps/mobile/lib/mock-conversion.test.ts` | Bun tests for pure helpers |
| `apps/mobile/app/property/[id]/visit.tsx` | Visit slot picker |
| `apps/mobile/app/property/[id]/book.tsx` | Short-stay dates |
| `apps/mobile/app/property/[id]/sale-inquiry.tsx` | Sale inquiry form |
| `apps/mobile/app/payment/[id].tsx` | Payment methods + success |
| `apps/mobile/app/(tabs)/activity.tsx` | Replace with 5-segment hub |
| `apps/mobile/app/property/[id]/index.tsx` | Wire CTAs + secondary sale link |
| `apps/mobile/app/_layout.tsx` | Register new stack screens |
| `apps/mobile/lib/auth-guard.ts` | Ensure `/property/` nested paths stay allowed (already OK) |

---

### Task 1: Shared UI primitives

**Files:**
- Create: `apps/mobile/components/ui/StatusBadge.tsx`
- Create: `apps/mobile/components/ui/SegmentTabs.tsx`
- Create: `apps/mobile/components/ui/SuccessScreen.tsx`
- Create: `apps/mobile/components/property/PropertySummaryCard.tsx`

**Interfaces:**
- Consumes: `colors`, `radii`, `spacing` from `@/constants/theme`; `Property` + `propertyPriceLabel` from `@/types/property`; `getPropertyGallery` from `@/lib/mock-properties`
- Produces:
  - `StatusBadge({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' })`
  - `SegmentTabs({ tabs, value, onChange }: { tabs: Array<{ key: string; label: string }>; value: string; onChange: (key: string) => void })`
  - `SuccessScreen({ title, message, primaryLabel, onPrimary, secondaryLabel?, onSecondary? })`
  - `PropertySummaryCard({ property }: { property: Property })`

- [ ] **Step 1: Create `StatusBadge.tsx`**

```tsx
import { colors, radii } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

export type StatusTone = 'success' | 'warning' | 'danger' | 'neutral';

const TONE: Record<StatusTone, { bg: string; fg: string }> = {
  success: { bg: '#DCFCE7', fg: colors.success },
  warning: { bg: colors.warningSoft, fg: '#B45309' },
  danger: { bg: '#FEE2E2', fg: colors.danger },
  neutral: { bg: colors.primaryMuted, fg: colors.muted },
};

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: StatusTone;
}): React.JSX.Element {
  const t = TONE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.text, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  text: { fontSize: 12, fontWeight: '700' },
});
```

- [ ] **Step 2: Create `SegmentTabs.tsx`**

Horizontal `ScrollView` of chips; active chip uses `colors.primary` / white text; `minHeight: 44`.

- [ ] **Step 3: Create `SuccessScreen.tsx`**

Centered icon (`checkmark-circle`), title, message, primary CTA (and optional secondary). Full flex screen, `colors.bg`.

- [ ] **Step 4: Create `PropertySummaryCard.tsx`**

Row: 64×64 image (`getPropertyGallery(property)[0]` or house fallback), title (1 line), location, `propertyPriceLabel(property)`. Card surface + border.

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && bunx tsc --noEmit`  
Expected: no errors from new files

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/components/ui/StatusBadge.tsx \
  apps/mobile/components/ui/SegmentTabs.tsx \
  apps/mobile/components/ui/SuccessScreen.tsx \
  apps/mobile/components/property/PropertySummaryCard.tsx
git commit -m "feat(mobile): add conversion UI primitives"
```

---

### Task 2: Mock conversion + activity data layer

**Files:**
- Create: `apps/mobile/lib/mock-conversion.ts`
- Create: `apps/mobile/lib/mock-activity.ts`
- Create: `apps/mobile/lib/mock-conversion.test.ts`

**Interfaces:**
- Consumes: property ids from `MOCK_PROPERTIES`
- Produces:
  - `type MockVisitSlot = { id: string; dayKey: string; dayLabel: string; startLabel: string; endLabel: string; paid: boolean; priceLabel?: string }`
  - `getMockVisitDays(propertyId: string): Array<{ key: string; label: string }>`
  - `getMockVisitSlots(propertyId: string, dayKey: string): MockVisitSlot[]`
  - `createMockPaymentSession(input: { kind: 'visit' | 'stay'; propertyId: string; amountLabel: string; title: string }): { id: string }`
  - `getMockPaymentSession(id: string): { id: string; kind: 'visit' | 'stay'; propertyId: string; amountLabel: string; title: string } | undefined`
  - `quoteShortStay(propertyId: string, startIso: string, endIso: string): { nights: number; totalLabel: string }`
  - `nightsBetween(startIso: string, endIso: string): number`
  - `type ActivitySegment = 'visits' | 'bookings' | 'sales' | 'payments' | 'rents'`
  - `type ActivityItem = { id: string; segment: ActivitySegment; propertyId: string; title: string; location: string; statusLabel: string; tone: StatusTone; meta: string }`
  - `listMockActivity(segment: ActivitySegment): ActivityItem[]`

- [ ] **Step 1: Write failing tests for `nightsBetween` and `quoteShortStay`**

```ts
import { describe, expect, test } from 'bun:test';
import { nightsBetween, quoteShortStay } from './mock-conversion';

describe('nightsBetween', () => {
  test('counts whole nights', () => {
    expect(nightsBetween('2026-07-12', '2026-07-14')).toBe(2);
  });
  test('returns 0 when end <= start', () => {
    expect(nightsBetween('2026-07-12', '2026-07-12')).toBe(0);
  });
});

describe('quoteShortStay', () => {
  test('returns nights and FCFA total for property 3', () => {
    const q = quoteShortStay('3', '2026-07-12', '2026-07-14');
    expect(q.nights).toBe(2);
    expect(q.totalLabel).toContain('FCFA');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/mobile && bun test lib/mock-conversion.test.ts`  
Expected: FAIL (module / exports missing)

- [ ] **Step 3: Implement `mock-conversion.ts`**

Include in-memory `Map` for payment sessions; visit slots for at least property `1` (mix free/paid) and `3`; `quoteShortStay` uses a fixed nightly amount from mock property price string parse or hardcode `45000` for id `3`.

- [ ] **Step 4: Implement `mock-activity.ts`**

At least 1–2 items per segment; property titles/locations from `getPropertyById`.

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd apps/mobile && bun test lib/mock-conversion.test.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/lib/mock-conversion.ts \
  apps/mobile/lib/mock-activity.ts \
  apps/mobile/lib/mock-conversion.test.ts
git commit -m "feat(mobile): add mock conversion and activity data"
```

---

### Task 3: Visit screen + stack registration

**Files:**
- Create: `apps/mobile/app/property/[id]/visit.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `ensureAuthenticated`, `PropertySummaryCard`, `getMockVisitDays`, `getMockVisitSlots`, `createMockPaymentSession`, `SuccessScreen`
- Produces: route `/property/[id]/visit`

- [ ] **Step 1: Register stack screen**

In `_layout.tsx`, add:

```tsx
<Stack.Screen
  name="property/[id]/visit"
  options={{
    headerShown: false,
    animation: 'slide_from_right',
  }}
/>
```

- [ ] **Step 2: Implement `visit.tsx`**

On focus: `ensureAuthenticated(router, `/property/${id}/visit`)`.  
UI: back + title « Visite », `PropertySummaryCard`, day chips, slot list, floating « Confirmer ».  
If selected slot `paid` → `createMockPaymentSession` then `router.push(`/payment/${session.id}`)`.  
Else → local `done` state rendering `SuccessScreen` with CTA to `/(tabs)/activity`.

- [ ] **Step 3: Manual smoke**

Open a `SALE`/`RENT_LONG` property → navigate manually to `/property/1/visit` (or via temporary button) → confirm login gate if logged out → pick slot.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/property/[id]/visit.tsx apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add visit booking UI screen"
```

---

### Task 4: Book + sale-inquiry screens

**Files:**
- Create: `apps/mobile/app/property/[id]/book.tsx`
- Create: `apps/mobile/app/property/[id]/sale-inquiry.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `quoteShortStay`, `createMockPaymentSession`, `getStoredUser`, `SuccessScreen`, `PropertySummaryCard`
- Produces: `/property/[id]/book`, `/property/[id]/sale-inquiry`

- [ ] **Step 1: Register both stack screens** (same options as visit)

- [ ] **Step 2: Implement `book.tsx`**

Auth gate with returnTo `/property/${id}/book`.  
Two date fields (ISO `YYYY-MM-DD` TextInputs or Pressable + simple next-7-days chips for start/end).  
Show `quoteShortStay` recap when `nights > 0`.  
Confirm → payment session `kind: 'stay'`.

- [ ] **Step 3: Implement `sale-inquiry.tsx`**

Auth gate. Message required TextInput, optional budget, phone from `getStoredUser()`.  
Submit → `SuccessScreen` « Demande envoyée » (no payment).

- [ ] **Step 4: Typecheck + commit**

```bash
cd apps/mobile && bunx tsc --noEmit
git add apps/mobile/app/property/[id]/book.tsx \
  apps/mobile/app/property/[id]/sale-inquiry.tsx \
  apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add short-stay book and sale inquiry UI"
```

---

### Task 5: Payment screen

**Files:**
- Create: `apps/mobile/app/payment/[id].tsx`
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**
- Consumes: `getMockPaymentSession`, `getPropertyById`, `PropertySummaryCard`, `SuccessScreen`
- Produces: `/payment/[id]`

- [ ] **Step 1: Register `payment/[id]` stack screen**

```tsx
<Stack.Screen
  name="payment/[id]"
  options={{ headerShown: false, animation: 'slide_from_right' }}
/>
```

- [ ] **Step 2: Implement payment UI**

Auth gate `returnTo: /payment/${id}`.  
Load session; if missing → empty « Paiement introuvable ».  
Methods: chips Mobile Money | Espèces.  
MM: phone TextInput + « Payer ».  
Cash: instructions + « J’ai compris ».  
On success → `SuccessScreen` primary « Voir mon activité » → `/(tabs)/activity`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/payment/[id].tsx apps/mobile/app/_layout.tsx
git commit -m "feat(mobile): add payment UI screen"
```

---

### Task 6: Wire property detail CTAs

**Files:**
- Modify: `apps/mobile/app/property/[id]/index.tsx`

**Interfaces:**
- Consumes: routes from Tasks 3–4
- Produces: mode-based navigation from floating CTA (+ secondary sale link)

- [ ] **Step 1: Replace `handleCtaPress` feedback with navigation**

```tsx
const handleCtaPress = (): void => {
  if (property.mode === 'RENT_SHORT') {
    router.push(`/property/${property.id}/book`);
    return;
  }
  router.push(`/property/${property.id}/visit`);
};
```

- [ ] **Step 2: For `SALE`, add secondary text button under CTA or in overlay**

Label: « Faire une demande d’achat » → `/property/${id}/sale-inquiry`.  
Only when `property.mode === 'SALE'`.

- [ ] **Step 3: Manual smoke all three modes on mocks (ids 1–3)**

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/property/[id]/index.tsx
git commit -m "feat(mobile): wire property CTAs to conversion screens"
```

---

### Task 7: Activity hub (5 segments)

**Files:**
- Modify: `apps/mobile/app/(tabs)/activity.tsx` (replace entirely)

**Interfaces:**
- Consumes: `SegmentTabs`, `StatusBadge`, `listMockActivity`, `ensureAuthenticated`
- Produces: full Activity UI per spec

- [ ] **Step 1: Rewrite `activity.tsx`**

On focus: `ensureAuthenticated(router, '/(tabs)/activity')`.  
Header « Mon activité ».  
`SegmentTabs` with keys `visits | bookings | sales | payments | rents` and French labels Visites · Réservations · Achats · Paiements · Loyers.  
`FlatList` of `listMockActivity(segment)` cards.  
Empty state per segment.  
`RefreshControl` reloads mock list (no-op fetch OK).  
Card tap: `router.push(`/property/${item.propertyId}`)` for visits/bookings/sales; for payments/rents show inline Feedback or navigate to property.

- [ ] **Step 2: Manual smoke** — login → Activity → switch all 5 tabs

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/(tabs)/activity.tsx
git commit -m "feat(mobile): rebuild activity hub with five segments"
```

---

### Task 8: End-to-end UI acceptance pass

**Files:** none (verification only)

- [ ] **Step 1: Run typecheck**

Run: `cd apps/mobile && bunx tsc --noEmit`  
Expected: PASS

- [ ] **Step 2: Run unit tests**

Run: `cd apps/mobile && bun test lib/mock-conversion.test.ts`  
Expected: PASS

- [ ] **Step 3: Manual checklist (from spec)**

- [ ] CTA by mode → visit / book / sale-inquiry  
- [ ] OTP gate on protected routes  
- [ ] Visit free → success; paid → payment → Activity  
- [ ] Book → payment → Activity  
- [ ] Sale inquiry → success  
- [ ] Activity shows 5 segments with cards/empties  
- [ ] Visual: primary purple, FR, floating CTAs  

- [ ] **Step 4: Final commit only if small fixes were needed**; otherwise done

---

## Spec coverage self-check

| Spec requirement | Task |
|------------------|------|
| Visit / book / sale-inquiry / payment routes | 3, 4, 5 |
| CTA mapping by mode + secondary sale | 6 |
| OTP gate | 3–5, 7 |
| Payment MM + cash + success → Activity | 5 |
| Activity 5 segments | 7 |
| Shared components | 1 |
| Mock layer resembling future API | 2 |
| UI-first / no API required | All |
| Acceptance checklist | 8 |

## Placeholder scan

No TBD / “implement later” left in tasks.
