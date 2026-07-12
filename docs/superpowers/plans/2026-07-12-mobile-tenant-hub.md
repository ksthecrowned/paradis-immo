# Mobile Tenant Locations Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Activité tab with a **Locations** tenant hub (next rent + Payer, or prospect pipeline), move Activity to a stack screen reachable from Profile, and point post-payment / post-conversion success back to the hub.

**Architecture:** New `(tabs)/locations` screen switches on `listActiveLeases()`. Active mode reuses `mock-leases` (`nextDueForLease`, tickets). Prospect mode reads `mock-activity` segments. Move `activity.tsx` out of tabs; update Profile, notifications, and success CTAs. UI-first — no API.

**Tech Stack:** Expo Router tabs + stack, React Native, Bun tests, existing Paradis theme.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-mobile-tenant-hub-design.md`
- French copy only; Paradis light theme
- Mocks only (`mock-leases`, `mock-activity`)
- Tab bar: Accueil · Découvrir · Favoris · **Locations** · Profil
- No Immofacile / RE/MAX tenant-ops features
- OTP gate on Locations / activity / leases (same as today)

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/mobile/lib/mock-leases.ts` | `listActiveLeases`, `getPrimaryActiveLease` |
| `apps/mobile/lib/mock-leases.test.ts` | Cover new helpers |
| `apps/mobile/lib/mock-activity.ts` | Optional `listProspectPipeline()` helper |
| `apps/mobile/components/tenant/TenantLeaseHero.tsx` | Bail hero strip |
| `apps/mobile/components/tenant/TenantRentCard.tsx` | Next rent + Payer |
| `apps/mobile/components/tenant/TenantQuickActions.tsx` | Bail / signalement / contact |
| `apps/mobile/components/tenant/ProspectPipelineList.tsx` | Visits + en cours cards |
| `apps/mobile/app/(tabs)/locations.tsx` | Hub orchestrator |
| `apps/mobile/app/(tabs)/_layout.tsx` | Swap activity → locations |
| `apps/mobile/app/activity.tsx` | Moved Activity screen |
| `apps/mobile/app/_layout.tsx` | Register `activity` stack screen |
| Delete or redirect: `apps/mobile/app/(tabs)/activity.tsx` | Remove from tabs |
| `apps/mobile/app/(tabs)/profile.tsx` | Menu links |
| `apps/mobile/app/payment/[id].tsx` | Success → locations |
| `apps/mobile/app/property/[id]/visit.tsx` | Success → activity or locations (historique) |
| `apps/mobile/app/property/[id]/sale-inquiry.tsx` | Success → `/activity` |
| `apps/mobile/lib/notifications.ts` | Deep link `/activity` |

---

### Task 1: Lease helpers (TDD)

**Files:**
- Modify: `apps/mobile/lib/mock-leases.ts`
- Modify: `apps/mobile/lib/mock-leases.test.ts`

**Interfaces:**
- Produces:

```ts
export function listActiveLeases(): MockLease[];
export function getPrimaryActiveLease(): MockLease | undefined;
// Prefer first ACTIVE by startDate desc (most recent start)
```

- [ ] **Step 1: Write failing tests**

```ts
test('listActiveLeases returns only ACTIVE', () => {
  const active = listActiveLeases();
  expect(active.every((l) => l.status === 'ACTIVE')).toBe(true);
  expect(active.some((l) => l.id === 'lease-1')).toBe(true);
  expect(active.some((l) => l.id === 'lease-2')).toBe(false);
});

test('getPrimaryActiveLease returns lease-1 in seed data', () => {
  expect(getPrimaryActiveLease()?.id).toBe('lease-1');
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/mobile && bun test lib/mock-leases.test.ts`  
Expected: FAIL (functions missing)

- [ ] **Step 3: Implement**

```ts
export function listActiveLeases(): MockLease[] {
  return listMockLeases()
    .filter((lease) => lease.status === 'ACTIVE')
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function getPrimaryActiveLease(): MockLease | undefined {
  return listActiveLeases()[0];
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `cd apps/mobile && bun test lib/mock-leases.test.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/mock-leases.ts apps/mobile/lib/mock-leases.test.ts
git commit -m "$(cat <<'EOF'
feat(mobile): add active-lease helpers for tenant hub

EOF
)"
```

---

### Task 2: Prospect pipeline helper

**Files:**
- Modify: `apps/mobile/lib/mock-activity.ts`
- Create or extend: `apps/mobile/lib/mock-activity.test.ts` (create if missing)

**Interfaces:**
- Produces:

```ts
export type ProspectSection = {
  key: 'upcoming' | 'in_progress';
  title: string;
  items: ActivityItem[];
};

export function listProspectPipeline(): ProspectSection[];
```

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, test } from 'bun:test';
import { listProspectPipeline } from './mock-activity';

test('listProspectPipeline has upcoming visits and in-progress rows', () => {
  const sections = listProspectPipeline();
  expect(sections.map((s) => s.key)).toEqual(['upcoming', 'in_progress']);
  expect(sections[0]!.items.every((i) => i.segment === 'visits')).toBe(true);
  expect(sections[1]!.items.length).toBeGreaterThan(0);
  expect(
    sections[1]!.items.every((i) =>
      ['bookings', 'sales', 'payments'].includes(i.segment),
    ),
  ).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/mobile && bun test lib/mock-activity.test.ts`

- [ ] **Step 3: Implement**

```ts
export function listProspectPipeline(): ProspectSection[] {
  return [
    {
      key: 'upcoming',
      title: 'À venir',
      items: listMockActivity('visits').filter(
        (item) => item.tone !== 'danger',
      ),
    },
    {
      key: 'in_progress',
      title: 'En cours',
      items: [
        ...listMockActivity('bookings'),
        ...listMockActivity('sales'),
        ...listMockActivity('payments'),
      ].filter((item) => item.tone !== 'danger'),
    },
  ];
}
```

Use existing `listMockActivity` export (add if only internal).

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/mock-activity.ts apps/mobile/lib/mock-activity.test.ts
git commit -m "$(cat <<'EOF'
feat(mobile): add prospect pipeline helper for Locations hub

EOF
)"
```

---

### Task 3: Tenant UI components

**Files:**
- Create: `apps/mobile/components/tenant/TenantLeaseHero.tsx`
- Create: `apps/mobile/components/tenant/TenantRentCard.tsx`
- Create: `apps/mobile/components/tenant/TenantQuickActions.tsx`
- Create: `apps/mobile/components/tenant/ProspectPipelineList.tsx`

**Interfaces:**
- Consumes: `MockLease`, `MockRentScheduleEntry`, `MockMaintenanceTicket`, `ActivityItem`, `Property`, agency/agent helpers
- Produces presentational components only (callbacks via props)

- [ ] **Step 1: `TenantLeaseHero`**

Props: `property`, `lease`, optional `agencyName`.  
Show title, location, `StatusBadge` with `leaseStatusLabel` / `leaseStatusTone`.

- [ ] **Step 2: `TenantRentCard`**

Props: `line: MockRentScheduleEntry`, `onPay: () => void`, `canPay: boolean`.  
Layout: label, amount FCFA, due date, badge, primary button « Payer » when `canPay`.

- [ ] **Step 3: `TenantQuickActions`**

Props: `onOpenLease`, `onMaintenance`, `onContact` (optional if no phone).  
Three equal pressables with icons (key / construct / call).

- [ ] **Step 4: `ProspectPipelineList`**

Props: `sections: ProspectSection[]`, `onItemPress(item)`.  
Section titles + compact rows (reuse Activity card visual language: badge, title, location, meta).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/tenant
git commit -m "$(cat <<'EOF'
feat(mobile): add tenant hub presentational components

EOF
)"
```

---

### Task 4: Locations tab screen

**Files:**
- Create: `apps/mobile/app/(tabs)/locations.tsx`

**Interfaces:**
- Consumes helpers + components from Tasks 1–3
- Auth: `ensureAuthenticated(router, '/(tabs)/locations')`

- [ ] **Step 1: Scaffold screen with auth + empty loading**

Same pattern as `activity.tsx` / `leases/index.tsx` (`useFocusEffect` + `ready` flag).

- [ ] **Step 2: Active-lease branch**

```tsx
const active = listActiveLeases();
const [selectedId, setSelectedId] = useState<string | null>(null);
const lease = active.find((l) => l.id === selectedId) ?? getPrimaryActiveLease();
// if active.length > 1 → chip row to setSelectedId
// TenantLeaseHero, TenantRentCard (nextDueForLease), TenantQuickActions
// schedule slice(0,3), open tickets
// Payer → router.push(`/payment/${line.paymentSessionId}`)
```

- [ ] **Step 3: Prospect branch**

When `listActiveLeases().length === 0`:
- Title « Votre espace location »
- `ProspectPipelineList` from `listProspectPipeline()`
- Buttons: Explorer → `/(tabs)/discover` ; Historique → `/activity`
- Optional link « Anciens baux » → `/leases` if any terminated exist

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(tabs\)/locations.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): add Locations tab tenant hub screen

EOF
)"
```

---

### Task 5: Tab bar swap + move Activity

**Files:**
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/app/activity.tsx` (move content from tabs)
- Delete: `apps/mobile/app/(tabs)/activity.tsx`
- Modify: `apps/mobile/app/_layout.tsx` — add `Stack.Screen name="activity"`

**Interfaces:**
- Tab Locations icon: `key` / `key-outline` (or `home` reserved — use `wallet` / `business` — prefer **`key`**)
- Activity auth path: `/activity` (not `/(tabs)/activity`)

- [ ] **Step 1: Update tabs layout**

Replace `activity` Tabs.Screen with:

```tsx
<Tabs.Screen
  name="locations"
  options={{
    title: 'Locations',
    headerTitle: 'Locations',
    headerShown: false,
    tabBarIcon: ({ color, size, focused }) => (
      <Ionicons
        name={focused ? 'key' : 'key-outline'}
        color={color}
        size={size}
      />
    ),
  }}
/>
```

- [ ] **Step 2: Move Activity screen**

Copy `app/(tabs)/activity.tsx` → `app/activity.tsx`.  
Change `ensureAuthenticated(router, '/activity')`.  
Add Stack.Screen in root `_layout.tsx`.  
Delete `(tabs)/activity.tsx`.

- [ ] **Step 3: Smoke-check Expo Router**

Ensure no duplicate `activity` under tabs. If Expo still expects the file, use `href: null` hide instead of delete — prefer clean delete.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/\(tabs\)/_layout.tsx apps/mobile/app/activity.tsx apps/mobile/app/_layout.tsx
git add -u apps/mobile/app/\(tabs\)/activity.tsx
git commit -m "$(cat <<'EOF'
feat(mobile): replace Activity tab with Locations; move historique to stack

EOF
)"
```

---

### Task 6: Wire Profile, notifications, success CTAs

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Modify: `apps/mobile/lib/notifications.ts`
- Modify: `apps/mobile/app/payment/[id].tsx`
- Modify: `apps/mobile/app/property/[id]/visit.tsx`
- Modify: `apps/mobile/app/property/[id]/sale-inquiry.tsx`
- Grep for `/(tabs)/activity` and update remaining hits

- [ ] **Step 1: Profile menu**

```ts
{
  key: 'leases',
  label: 'Mes locations',
  icon: 'key-outline',
  onPress: () => router.push('/(tabs)/locations'),
},
{
  key: 'activity',
  label: 'Mon historique',
  icon: 'time-outline',
  onPress: () => router.push('/activity'),
},
```

- [ ] **Step 2: Notifications deep link**

```ts
if (data.screen === 'activity') {
  return { pathname: '/activity' };
}
```

- [ ] **Step 3: Payment success**

Rent (and optionally all) success primary CTA:

```ts
onPrimary={() => router.replace('/(tabs)/locations')}
```

Visit / sale-inquiry success → `/activity` (historique), not tabs activity.

- [ ] **Step 4: Grep cleanup**

Run: `rg "/\(tabs\)/activity" apps/mobile`  
Expected: no matches (or only comments)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/app/\(tabs\)/profile.tsx apps/mobile/lib/notifications.ts \
  apps/mobile/app/payment apps/mobile/app/property
git commit -m "$(cat <<'EOF'
feat(mobile): point Profile and success flows to Locations / historique

EOF
)"
```

---

### Task 7: Manual verification checklist

- [ ] **Step 1: Run unit tests**

Run: `cd apps/mobile && bun test lib/mock-leases.test.ts lib/mock-activity.test.ts`  
Expected: PASS

- [ ] **Step 2: Manual on device/emulator**

1. Tab bar shows Locations (not Activité)  
2. Logged-in with seed: hub shows lease-1 + Payer for overdue/pending  
3. Payer opens payment; success returns to Locations  
4. Profile → Mon historique opens `/activity`  
5. Temporarily force `listActiveLeases` empty (or terminate lease-1 in mock) → prospect UI  

- [ ] **Step 3: Final commit if fixes needed**

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Active lease helpers | 1 |
| Prospect pipeline data | 2 |
| Tenant UI pieces | 3 |
| Locations hub modes | 4 |
| Tab bar swap + Activity move | 5 |
| Profile / deep links / post-pay | 6 |
| Manual acceptance | 7 |
| RE/MAX / Immofacile non-goals | — documented, no code |

## Self-review notes

- Success CTAs: rent → Locations; visit/sale → `/activity` historique (explicit)  
- Multi-bail: chip selector only if `active.length > 1` (seed has one ACTIVE — still implement)  
- No placeholder TBD steps
