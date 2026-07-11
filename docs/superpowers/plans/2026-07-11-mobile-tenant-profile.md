# Mobile Tenant Space + Richer Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship tenant lease management (list, schedule, pay rent, maintenance) and a richer Profile (edit, settings, documents) with dual entry from Profile and Activity → Loyers.

**Architecture:** Shared mock domain in `lib/mock-leases.ts` (+ documents/preferences helpers). Expo Router stacks `/leases…` and `/profile/…`. Activity `rents` navigates to `/leases/[id]`. Rent payment reuses `/payment/[id]` with session `kind: 'rent'`.

**Tech Stack:** Expo Router, React Native, TypeScript, Bun tests, AsyncStorage, existing theme / StatusBadge / Feedback / auth-guard.

## Global Constraints

- French copy only
- UI mocks only — do not call `GET /leases/my` yet (`lib/leases.ts` stays unused by screens)
- No fifth tab; no document upload
- Auth via `ensureAuthenticated` on all new screens
- Spec: `docs/superpowers/specs/2026-07-11-mobile-tenant-profile-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/mobile/lib/mock-leases.ts` | Leases, schedule, maintenance CRUD-in-memory, labels, Activity rent projection |
| `apps/mobile/lib/mock-leases.test.ts` | Domain tests |
| `apps/mobile/lib/mock-documents.ts` | Tenant documents list |
| `apps/mobile/lib/user-preferences.ts` | Theme / push prefs AsyncStorage |
| `apps/mobile/lib/mock-conversion.ts` | Extend payment `kind` with `'rent'`; seed rent sessions |
| `apps/mobile/lib/auth.ts` | `updateStoredUser`; optional `email` on `AuthUser` |
| `apps/mobile/lib/mock-activity.ts` | Derive `rents` from mock-leases (or thin wrapper) |
| `apps/mobile/app/leases/index.tsx` | Lease list |
| `apps/mobile/app/leases/[id]/index.tsx` | Lease detail |
| `apps/mobile/app/leases/[id]/maintenance/new.tsx` | New ticket form |
| `apps/mobile/app/profile/edit.tsx` | Edit name / email |
| `apps/mobile/app/profile/settings.tsx` | Language / theme / push |
| `apps/mobile/app/profile/documents.tsx` | Documents + preview |
| `apps/mobile/app/(tabs)/profile.tsx` | Menu + Modifier |
| `apps/mobile/app/(tabs)/activity.tsx` | Rents → `/leases/[id]` |
| `apps/mobile/app/payment/[id].tsx` | Show rent copy when `kind === 'rent'` if needed |
| `apps/mobile/app/_layout.tsx` | Register Stack screens |

---

### Task 1: Mock leases domain + tests

**Files:**
- Create: `apps/mobile/lib/mock-leases.ts`
- Create: `apps/mobile/lib/mock-leases.test.ts`

**Interfaces (produce):**

```ts
export type LeaseStatus = 'ACTIVE' | 'TERMINATED';
export type RentLineStatus = 'PENDING' | 'PAID' | 'OVERDUE';
export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type MaintenanceUrgency = 'LOW' | 'NORMAL' | 'HIGH';

export type MockLease = {
  id: string;
  propertyId: string;
  status: LeaseStatus;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  deposit: number;
  currency: 'FCFA';
  agencyId: string;
  agentId: string;
};

export type MockRentScheduleEntry = {
  id: string;
  leaseId: string;
  label: string;
  dueDate: string;
  amount: number;
  status: RentLineStatus;
  paymentSessionId?: string;
};

export type MockMaintenanceTicket = {
  id: string;
  leaseId: string;
  title: string;
  description: string;
  urgency: MaintenanceUrgency;
  status: MaintenanceStatus;
  createdAt: string;
};

export function listMockLeases(): MockLease[];
export function getMockLease(id: string): MockLease | undefined;
export function listScheduleForLease(leaseId: string): MockRentScheduleEntry[];
export function nextDueForLease(leaseId: string): MockRentScheduleEntry | undefined;
export function listTicketsForLease(leaseId: string): MockMaintenanceTicket[];
export function addMaintenanceTicket(input: {
  leaseId: string;
  title: string;
  description: string;
  urgency: MaintenanceUrgency;
}): MockMaintenanceTicket;
export function leaseStatusLabel(s: LeaseStatus): string;
export function rentLineStatusLabel(s: RentLineStatus): string;
export function maintenanceStatusLabel(s: MaintenanceStatus): string;
export function maintenanceUrgencyLabel(s: MaintenanceUrgency): string;
export function canPayRentLine(lease: MockLease, line: MockRentScheduleEntry): boolean;
export function canCreateMaintenance(lease: MockLease): boolean;
/** Activity projection */
export function listRentActivityItems(): Array<{
  id: string;
  leaseId: string;
  propertyId: string;
  statusLabel: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
  meta: string;
}>;
```

**Seed (exact ids):**

- Lease `lease-1`: property `2`, ACTIVE, agency/agent from property 2, rent `100000`, deposit `200000`, start `2026-01-01`
  - Schedule: `rent-1-jun` PAID Jun 2026; `rent-1-jul` PENDING Jul 2026 amount 100000 `paymentSessionId: 'pay-rent-jul'`; optional `rent-1-may` OVERDUE if desired
  - Tickets: ≥2 (OPEN + RESOLVED or IN_PROGRESS)
- Lease `lease-2`: property `1`, TERMINATED, endDate set, schedule all PAID, no payable session

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, test } from 'bun:test';
import {
  addMaintenanceTicket,
  canCreateMaintenance,
  canPayRentLine,
  getMockLease,
  leaseStatusLabel,
  listMockLeases,
  listRentActivityItems,
  listScheduleForLease,
  listTicketsForLease,
  nextDueForLease,
} from './mock-leases';

describe('mock leases', () => {
  test('lists active and terminated', () => {
    const leases = listMockLeases();
    expect(leases.length).toBeGreaterThanOrEqual(2);
    expect(leases.some((l) => l.status === 'ACTIVE')).toBe(true);
    expect(leases.some((l) => l.status === 'TERMINATED')).toBe(true);
  });

  test('active lease has payable line', () => {
    const lease = getMockLease('lease-1')!;
    const next = nextDueForLease('lease-1');
    expect(next?.status).toBe('PENDING');
    expect(canPayRentLine(lease, next!)).toBe(true);
  });

  test('terminated cannot pay or create ticket', () => {
    const lease = getMockLease('lease-2')!;
    expect(canCreateMaintenance(lease)).toBe(false);
    const lines = listScheduleForLease('lease-2');
    for (const line of lines) {
      expect(canPayRentLine(lease, line)).toBe(false);
    }
  });

  test('addMaintenanceTicket prepends OPEN', () => {
    const before = listTicketsForLease('lease-1').length;
    const t = addMaintenanceTicket({
      leaseId: 'lease-1',
      title: 'Fuite',
      description: 'Cuisine',
      urgency: 'HIGH',
    });
    expect(t.status).toBe('OPEN');
    expect(listTicketsForLease('lease-1').length).toBe(before + 1);
    expect(listTicketsForLease('lease-1')[0]?.id).toBe(t.id);
  });

  test('rent activity projects schedule', () => {
    const items = listRentActivityItems();
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((i) => i.leaseId && i.propertyId)).toBe(true);
  });

  test('labels FR', () => {
    expect(leaseStatusLabel('ACTIVE')).toBe('Actif');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/mobile && bun test lib/mock-leases.test.ts
```

- [ ] **Step 3: Implement `mock-leases.ts`** with in-memory mutable `tickets` array so `addMaintenanceTicket` works across the session; schedules/leases can be const.

`canPayRentLine`: `lease.status === 'ACTIVE' && (line.status === 'PENDING' || line.status === 'OVERDUE') && Boolean(line.paymentSessionId)`

`canCreateMaintenance`: `lease.status === 'ACTIVE'`

`nextDueForLease`: first OVERDUE else first PENDING by `dueDate` ascending; else undefined

`listRentActivityItems`: map schedule lines (or next due + recent paid) to activity-shaped rows with French `meta` like `Juillet 2026 · 100 000 FCFA`

- [ ] **Step 4: Tests PASS + commit**

```bash
git add apps/mobile/lib/mock-leases.ts apps/mobile/lib/mock-leases.test.ts
git commit -m "feat(mobile): add mock leases, schedule, and maintenance domain"
```

---

### Task 2: Rent payment sessions + Activity rents source

**Files:**
- Modify: `apps/mobile/lib/mock-conversion.ts`
- Modify: `apps/mobile/lib/mock-activity.ts`
- Modify: `apps/mobile/lib/mock-conversion.test.ts` (if present) or small assert in mock-leases already covers activity

**Interfaces:**

```ts
// MockPaymentSession.kind becomes:
kind: 'visit' | 'stay' | 'rent';
```

- [ ] **Step 1: Seed static rent session**

At module init in `mock-conversion.ts`:

```ts
paymentSessions.set('pay-rent-jul', {
  id: 'pay-rent-jul',
  kind: 'rent',
  propertyId: '2',
  amountLabel: '100 000 FCFA',
  title: 'Loyer · Juillet 2026',
});
```

Extend `createMockPaymentSession` input kind union to include `'rent'`.

- [ ] **Step 2: Activity rents**

In `mock-activity.ts`:

- Remove hard-coded `rents` ITEMS entries (act-r1, act-r2)
- Extend `ActivityItem` with optional `leaseId?: string`
- `listMockActivity('rents')` returns mapped `listRentActivityItems()`:

```ts
import { listRentActivityItems } from './mock-leases';
import { getPropertyById } from './mock-properties';

// inside listMockActivity:
if (segment === 'rents') {
  return listRentActivityItems().map((row) => {
    const property = getPropertyById(row.propertyId);
    return {
      id: row.id,
      segment: 'rents' as const,
      propertyId: row.propertyId,
      leaseId: row.leaseId,
      title: property?.title ?? 'Bien',
      location: property?.location ?? 'Pointe-Noire',
      statusLabel: row.statusLabel,
      tone: row.tone,
      meta: row.meta,
    };
  });
}
```

- [ ] **Step 3: Payment screen copy** (light touch)

In `apps/mobile/app/payment/[id].tsx`, if `session.kind === 'rent'`, keep existing UI (title/amount already on session). No structural change required beyond TypeScript compiling.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): seed rent payment sessions and derive Activity Loyers"
```

---

### Task 3: Leases list screen + Stack registration

**Files:**
- Create: `apps/mobile/app/leases/index.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

**UI:** Auth gate → header « Mes locations » → FlatList of leases.

Each row:
- Property title + location from `getPropertyById`
- `StatusBadge` with `leaseStatusLabel` / tone (ACTIVE success, TERMINATED neutral)
- Loyer: format amount + ` FCFA`
- Next due line if `nextDueForLease` else « Aucune échéance »

Tap → `router.push(\`/leases/${lease.id}\`)`

Empty: Ionicons + « Aucun bail » + button « Explorer » → `/(tabs)`

- [ ] **Step 1: Implement list screen** following `activity.tsx` patterns (`ensureAuthenticated`, safe area, refresh tick).

- [ ] **Step 2: Register in `_layout.tsx`**

```tsx
<Stack.Screen
  name="leases/index"
  options={{ headerShown: false, animation: 'slide_from_right' }}
/>
<Stack.Screen
  name="leases/[id]/index"
  options={{ headerShown: false, animation: 'slide_from_right' }}
/>
<Stack.Screen
  name="leases/[id]/maintenance/new"
  options={{ headerShown: false, animation: 'slide_from_right' }}
/>
```

(Detail/maintenance screens can be stubs returning `<View />` until Task 4 so Router resolves.)

- [ ] **Step 3: Manual smoke** — navigate via temporary Profile link or Expo Router path `/leases` when logged in.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): add Mes locations lease list screen"
```

---

### Task 4: Lease detail + maintenance form

**Files:**
- Create: `apps/mobile/app/leases/[id]/index.tsx`
- Create: `apps/mobile/app/leases/[id]/maintenance/new.tsx`

**Detail sections:**

1. Back button + title « Mon bail »
2. **Bail** card: property summary pressable → `/property/${propertyId}`; agency name via `getAgency`; dates; loyer; caution; status badge
3. **Échéancier**: map `listScheduleForLease`; each row status badge; if `canPayRentLine(lease, line)` show Pressable « Payer » → `router.push(\`/payment/${line.paymentSessionId}\`)`
4. **Maintenance**: `listTicketsForLease`; if `canCreateMaintenance` show CTA → `/leases/${id}/maintenance/new`; else Text « Bail terminé — signalement indisponible »

**New ticket form:**

- Title TextInput, description multiline, urgency SegmentTabs or 3 chips (Basse / Normale / Haute)
- Submit: validate title length ≥ 3; `addMaintenanceTicket`; `showFeedback` success; `router.back()`
- If lease missing or `!canCreateMaintenance`: feedback + back

- [ ] **Step 1: Implement detail**
- [ ] **Step 2: Implement form**
- [ ] **Step 3: Smoke** — pay CTA opens payment; new ticket appears first on detail after submit
- [ ] **Step 4: Commit**

```bash
git commit -m "feat(mobile): lease detail with rent schedule and maintenance"
```

---

### Task 5: Dual entry — Profile menu stub + Activity navigation

**Files:**
- Modify: `apps/mobile/app/(tabs)/activity.tsx`
- Modify: `apps/mobile/app/(tabs)/profile.tsx` (menu entries only; full D in Tasks 6–7)

- [ ] **Step 1: Activity `onItemPress`**

```ts
const onItemPress = (item: ActivityItem): void => {
  if (item.segment === 'rents' && item.leaseId) {
    router.push(`/leases/${item.leaseId}`);
    return;
  }
  router.push(`/property/${item.propertyId}`);
};
```

- [ ] **Step 2: Profile menu** — insert at top of menu array:

```ts
{
  key: 'leases',
  label: 'Mes locations',
  icon: 'key-outline',
  onPress: () => router.push('/leases'),
},
{
  key: 'documents',
  label: 'Mes documents',
  icon: 'document-text-outline',
  onPress: () => router.push('/profile/documents'),
},
// existing favorites, activity, notifications…
{
  key: 'settings',
  label: 'Réglages',
  icon: 'settings-outline',
  onPress: () => router.push('/profile/settings'),
},
```

Keep Aide last before logout. Add « Modifier » on identity card → `/profile/edit` (screen stub ok until Task 6).

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): dual entry to leases from Profile and Activity"
```

---

### Task 6: Profile edit + `updateStoredUser`

**Files:**
- Modify: `apps/mobile/lib/auth.ts`
- Create: `apps/mobile/app/profile/edit.tsx`
- Modify: `apps/mobile/app/_layout.tsx` (register `profile/edit`, `profile/settings`, `profile/documents`)

**Auth:**

```ts
export type AuthUser = {
  id: string;
  phone: string;
  name: string | null;
  email?: string | null;
  roles: string[];
};

export async function updateStoredUser(
  patch: Partial<Pick<AuthUser, 'name' | 'email'>>,
): Promise<AuthUser | null> {
  const user = await getStoredUser();
  if (!user) return null;
  const next: AuthUser = {
    ...user,
    name: patch.name !== undefined ? patch.name : user.name,
    email: patch.email !== undefined ? patch.email : user.email ?? null,
  };
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(next));
  return next;
}
```

Also pass `email` through `unwrapTokens` / `saveTokens` path as optional (default null).

**Edit screen:** load user; TextInputs name + email; phone disabled Text; save → `updateStoredUser` (local only, no API required for this pass) → feedback « Profil mis à jour » → `router.back()`. If not authenticated, gate.

- [ ] **Step 1: Unit-ish check** — optional tiny test file not required; manual verify AsyncStorage via edit round-trip
- [ ] **Step 2: Implement edit + layout screens**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): profile edit with local AuthUser update"
```

---

### Task 7: Settings + documents

**Files:**
- Create: `apps/mobile/lib/user-preferences.ts`
- Create: `apps/mobile/lib/mock-documents.ts`
- Create: `apps/mobile/app/profile/settings.tsx`
- Create: `apps/mobile/app/profile/documents.tsx`

**Preferences:**

```ts
export type ThemePreference = 'system' | 'light' | 'dark';

export type UserPreferences = {
  theme: ThemePreference;
  pushEnabled: boolean;
};

export const DEFAULT_PREFS: UserPreferences = {
  theme: 'system',
  pushEnabled: true,
};

export async function getUserPreferences(): Promise<UserPreferences>;
export async function setUserPreferences(
  patch: Partial<UserPreferences>,
): Promise<UserPreferences>;
```

Storage key: `paradisImmo.userPreferences`

**Settings UI:**

- Langue: row Français selected; English row disabled with subtitle « Bientôt »
- Thème: 3 options; on change `setUserPreferences` + `showFeedback` info « Préférence enregistrée » (no full ThemeProvider — YAGNI)
- Push: Switch bound to `pushEnabled`

**Documents:**

```ts
export type DocumentStatus = 'VALIDATED' | 'PENDING' | 'MISSING';
export type MockTenantDocument = {
  id: string;
  title: string;
  status: DocumentStatus;
  leaseId?: string;
  previewHint: string;
};
export function listMockDocuments(): MockTenantDocument[];
export function documentStatusLabel(s: DocumentStatus): string;
```

Seed ≥3 docs with mixed statuses; one linked to `lease-1`.

UI: list + StatusBadge; tap → Feedback or Modal with `previewHint`; footer button « Ajouter un document » → Feedback « Bientôt ».

- [ ] **Step 1: Implement libs + screens**
- [ ] **Step 2: Smoke** — toggle push persists across leave/re-enter settings; open document preview
- [ ] **Step 3: Commit**

```bash
git commit -m "feat(mobile): profile settings and tenant documents mocks"
```

---

### Task 8: Acceptance pass

- [ ] **Step 1: Checklist from spec**

1. Profile → Mes locations → detail → Payer → payment success mock  
2. Signaler un problème → ticket on detail  
3. Activity → Loyers → same lease detail  
4. Edit name; toggle push; open document  
5. Terminated lease: no pay / no new ticket  
6. Logged-out `/leases` → OTP gate  

- [ ] **Step 2: Run unit tests**

```bash
cd apps/mobile && bun test lib/mock-leases.test.ts
```

Expected: PASS

- [ ] **Step 3: Final commit if any polish**

```bash
git commit -m "chore(mobile): polish tenant space and profile acceptance"
```

(Skip empty commit if clean.)

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| `/leases` list | 3 |
| `/leases/[id]` schedule + pay + maintenance | 4 |
| `/leases/.../maintenance/new` | 4 |
| Pay via `/payment/[id]` rent session | 2, 4 |
| Dual entry Profile + Activity | 5 |
| Profile edit | 6 |
| Settings language/theme/push | 7 |
| Documents + preview / Ajouter bientôt | 7 |
| Terminated guards | 1, 4 |
| Auth gates | 3–7 |
| French + mocks only | Global |

No placeholders left in task steps. Types aligned on `lease-1` / `pay-rent-jul` / `MockPaymentSession.kind: 'rent'`.
