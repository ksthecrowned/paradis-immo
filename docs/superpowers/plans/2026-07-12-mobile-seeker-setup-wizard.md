# Mobile Seeker Setup Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After register OTP, run a 4-step seeker preference wizard (intent → experience → budget → quartiers), persist once via `PATCH /users/me`, then continue to `personnal-infos`, and seed search/home filter defaults from those prefs.

**Architecture:** Prisma fields on `User` + extended `updateMe`. Mobile Expo Router stack `app/(auth)/setup/*` with in-memory `SeekerSetupProvider`, shared `SetupShell`, single PATCH on exit (sets `seekerSetupCompletedAt`). Pure mapper seeds `SearchFilters` from `PublicUser`.

**Tech Stack:** NestJS + Prisma, Expo Router, React Native, Bun test runner for mobile pure helpers, existing Jest API unit tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-mobile-seeker-setup-wizard-design.md`
- French copy only
- Visual: existing `colors.*` (violet) — no lime, no forced-dark wizard
- Trigger: **register OTP only** → setup → `personnal-infos`; login never forces wizard
- Persist: **one** `PATCH /users/me` on wizard exit; block navigation to `personnal-infos` until success
- Max 3 `preferredQuartierIds`; Skip allowed on every step
- Default city for quartiers: Brazzaville
- GPS / profile re-edit / login re-prompt: out of scope

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Enums + User seeker fields |
| `apps/api/prisma/migrations/…` | Migration SQL |
| `apps/api/src/users/dto/update-me.dto.ts` | Validate seeker patch |
| `apps/api/src/users/users.service.ts` | Persist + expose on `PublicUser` |
| `apps/api/src/users/users.service.spec.ts` | API unit tests |
| `apps/mobile/lib/seeker-setup.ts` | Types, budget bands, popular names, filter mapper |
| `apps/mobile/lib/seeker-setup.test.ts` | Mapper + band tests |
| `apps/mobile/lib/users.ts` | Extend `PublicUser` / `updateMe` / sync |
| `apps/mobile/lib/auth.ts` | Optional seeker fields on `AuthUser` |
| `apps/mobile/lib/locations.ts` | Helper to load all quartiers for a city |
| `apps/mobile/context/SeekerSetupContext.tsx` | In-memory draft |
| `apps/mobile/components/setup/SetupShell.tsx` | Progress + Skip + Continue |
| `apps/mobile/components/setup/SetupOptionCard.tsx` | Selectable card |
| `apps/mobile/app/(auth)/setup/_layout.tsx` | Provider + stack |
| `apps/mobile/app/(auth)/setup/intent.tsx` | Step 1 |
| `apps/mobile/app/(auth)/setup/experience.tsx` | Step 2 |
| `apps/mobile/app/(auth)/setup/budget.tsx` | Step 3 |
| `apps/mobile/app/(auth)/setup/neighborhoods.tsx` | Step 4 + persist exit |
| `apps/mobile/app/(auth)/otp-verify.tsx` | Register → setup |
| `apps/mobile/app/_layout.tsx` | Register setup route |
| `apps/mobile/app/(tabs)/index.tsx` and/or `app/search.tsx` | Seed defaults from prefs |

---

### Task 1: Prisma seeker fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260712150000_user_seeker_setup/migration.sql`

**Interfaces:**
- Produces enums: `SeekerIntent` (`RENT` \| `BUY` \| `BOTH`), `SeekerExperience` (`FIRST_TIME` \| `RETURNING` \| `PRO`)
- Produces on `User`: `seekerIntent`, `seekerExperience`, `budgetMinXaf`, `budgetMaxXaf`, `preferredQuartierIds`, `seekerSetupCompletedAt`

- [ ] **Step 1: Add enums and fields to schema**

In `schema.prisma`, add near other enums:

```prisma
enum SeekerIntent {
  RENT
  BUY
  BOTH
}

enum SeekerExperience {
  FIRST_TIME
  RETURNING
  PRO
}
```

On `model User`, after `notificationChannel`:

```prisma
  seekerIntent            SeekerIntent?
  seekerExperience        SeekerExperience?
  budgetMinXaf            Int?
  budgetMaxXaf            Int?
  preferredQuartierIds    String[]   @default([])
  seekerSetupCompletedAt  DateTime?
```

- [ ] **Step 2: Create migration SQL**

`apps/api/prisma/migrations/20260712150000_user_seeker_setup/migration.sql`:

```sql
CREATE TYPE "SeekerIntent" AS ENUM ('RENT', 'BUY', 'BOTH');
CREATE TYPE "SeekerExperience" AS ENUM ('FIRST_TIME', 'RETURNING', 'PRO');

ALTER TABLE "User"
  ADD COLUMN "seekerIntent" "SeekerIntent",
  ADD COLUMN "seekerExperience" "SeekerExperience",
  ADD COLUMN "budgetMinXaf" INTEGER,
  ADD COLUMN "budgetMaxXaf" INTEGER,
  ADD COLUMN "preferredQuartierIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "seekerSetupCompletedAt" TIMESTAMP(3);
```

- [ ] **Step 3: Apply migration locally**

Run: `cd apps/api && bunx prisma migrate deploy && bunx prisma generate`  
Expected: migrate applied, client regenerated

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260712150000_user_seeker_setup
git commit -m "feat(api): add User seeker setup preference fields"
```

---

### Task 2: API `updateMe` seeker prefs (TDD)

**Files:**
- Modify: `apps/api/src/users/dto/update-me.dto.ts`
- Modify: `apps/api/src/users/users.service.ts`
- Modify: `apps/api/src/users/users.service.spec.ts`

**Interfaces:**
- Extends `PublicUser` with:
  - `seekerIntent: 'RENT' | 'BUY' | 'BOTH' | null`
  - `seekerExperience: 'FIRST_TIME' | 'RETURNING' | 'PRO' | null`
  - `budgetMinXaf: number | null`
  - `budgetMaxXaf: number | null`
  - `preferredQuartierIds: string[]`
  - `seekerSetupCompletedAt: string | null` (ISO)
- `updateMe` accepts those fields; when `seekerSetupCompletedAt: true` (boolean flag in DTO) or ISO string — **use boolean `completeSeekerSetup?: boolean`** that sets `seekerSetupCompletedAt = now()` server-side (clearer than client sending Date)

- [ ] **Step 1: Write failing tests**

Append to `users.service.spec.ts`:

```ts
  it('updateMe patches seeker prefs and completeSeekerSetup', async () => {
    const q = await prisma.quartier.findFirst({
      where: { name: 'Poto-Poto-Centre' },
    });
    expect(q).toBeTruthy();

    const updated = await users.updateMe(userId, {
      seekerIntent: 'RENT',
      seekerExperience: 'FIRST_TIME',
      budgetMinXaf: 100_000,
      budgetMaxXaf: 250_000,
      preferredQuartierIds: [q!.id],
      completeSeekerSetup: true,
    });

    expect(updated.seekerIntent).toBe('RENT');
    expect(updated.seekerExperience).toBe('FIRST_TIME');
    expect(updated.budgetMinXaf).toBe(100_000);
    expect(updated.budgetMaxXaf).toBe(250_000);
    expect(updated.preferredQuartierIds).toEqual([q!.id]);
    expect(updated.seekerSetupCompletedAt).toBeTruthy();
  });

  it('updateMe rejects more than 3 preferredQuartierIds', async () => {
    await expect(
      users.updateMe(userId, {
        preferredQuartierIds: ['a', 'b', 'c', 'd'],
      }),
    ).rejects.toThrow();
  });

  it('updateMe rejects budgetMin > budgetMax', async () => {
    await expect(
      users.updateMe(userId, {
        budgetMinXaf: 500_000,
        budgetMaxXaf: 100_000,
      }),
    ).rejects.toThrow();
  });
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/api && bun run test -- users.service.spec.ts`  
Expected: FAIL (fields / methods missing)

- [ ] **Step 3: Extend DTO**

```ts
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateMeDto {
  // ...existing fields...

  @IsOptional()
  @IsIn(['RENT', 'BUY', 'BOTH'])
  seekerIntent?: 'RENT' | 'BUY' | 'BOTH';

  @IsOptional()
  @IsIn(['FIRST_TIME', 'RETURNING', 'PRO'])
  seekerExperience?: 'FIRST_TIME' | 'RETURNING' | 'PRO';

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMinXaf?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMaxXaf?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  preferredQuartierIds?: string[];

  /** When true, server sets seekerSetupCompletedAt = now(). */
  @IsOptional()
  @IsBoolean()
  completeSeekerSetup?: boolean;
}
```

- [ ] **Step 4: Implement service**

In `users.service.ts`:

- Extend `PublicUser` with seeker fields
- Extend `updateMe` patch type
- Before update: if `preferredQuartierIds` provided, `length > 3` → `BadRequestException`; if length > 0, `prisma.quartier.count({ where: { id: { in: ids } } })` must equal `ids.length`
- If both budget bounds provided and `min > max` → `BadRequestException`
- Map enums; if `completeSeekerSetup === true` set `seekerSetupCompletedAt: new Date()`
- `toPublic` returns ISO string or null for completedAt

```ts
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalRole,
  NotificationChannel,
  SeekerExperience,
  SeekerIntent,
  User,
} from '@prisma/client';
```

- [ ] **Step 5: Run tests — expect PASS**

Run: `cd apps/api && bun run test -- users.service.spec.ts`  
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/users
git commit -m "feat(api): persist seeker setup prefs on updateMe"
```

---

### Task 3: Mobile seeker domain helpers (TDD)

**Files:**
- Create: `apps/mobile/lib/seeker-setup.ts`
- Create: `apps/mobile/lib/seeker-setup.test.ts`
- Modify: `apps/mobile/lib/users.ts`
- Modify: `apps/mobile/lib/auth.ts`
- Modify: `apps/mobile/lib/locations.ts`

**Interfaces:**
- Produces:
  - `SeekerIntent`, `SeekerExperience` string unions
  - `SeekerSetupDraft`
  - `BUDGET_BANDS_RENT` / `BUDGET_BANDS_BUY`: `{ id, label, min, max: number | null }[]`
  - `POPULAR_QUARTIER_NAMES: string[]` (Brazzaville seed names)
  - `seekerPrefsToSearchFilters(prefs, base?): SearchFilters`
  - `listQuartiersForCity(cityId): Promise<PublicQuartier[]>`
  - Extended `PublicUser` + `updateMe` patch + `AuthUser` optional seeker fields

- [ ] **Step 1: Write failing tests**

`apps/mobile/lib/seeker-setup.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';
import { DEFAULT_SEARCH_FILTERS } from '@/lib/search-filters';
import {
  seekerPrefsToSearchFilters,
  type SeekerPrefsLike,
} from '@/lib/seeker-setup';

describe('seekerPrefsToSearchFilters', () => {
  test('maps RENT intent and budget', () => {
    const prefs: SeekerPrefsLike = {
      seekerIntent: 'RENT',
      seekerExperience: 'FIRST_TIME',
      budgetMinXaf: 100_000,
      budgetMaxXaf: 250_000,
      preferredQuartierIds: [],
    };
    const f = seekerPrefsToSearchFilters(prefs);
    expect(f.mode).toBe('RENT_LONG');
    expect(f.minPrice).toBe(100_000);
    expect(f.maxPrice).toBe(250_000);
  });

  test('maps BUY to SALE', () => {
    const f = seekerPrefsToSearchFilters({
      seekerIntent: 'BUY',
      seekerExperience: null,
      budgetMinXaf: null,
      budgetMaxXaf: null,
      preferredQuartierIds: [],
    });
    expect(f.mode).toBe('SALE');
  });

  test('BOTH defaults to RENT_LONG', () => {
    const f = seekerPrefsToSearchFilters({
      seekerIntent: 'BOTH',
      seekerExperience: null,
      budgetMinXaf: null,
      budgetMaxXaf: null,
      preferredQuartierIds: [],
    });
    expect(f.mode).toBe('RENT_LONG');
  });

  test('seeds first preferred quartier when resolver provided', () => {
    const f = seekerPrefsToSearchFilters(
      {
        seekerIntent: 'RENT',
        seekerExperience: null,
        budgetMinXaf: null,
        budgetMaxXaf: null,
        preferredQuartierIds: ['q1', 'q2'],
      },
      DEFAULT_SEARCH_FILTERS,
      {
        resolveQuartier: (id) =>
          id === 'q1'
            ? { id: 'q1', name: 'Poto-Poto', cityId: 'c1', cityName: 'Brazzaville' }
            : null,
      },
    );
    expect(f.quartierId).toBe('q1');
    expect(f.quartierName).toBe('Poto-Poto');
    expect(f.cityId).toBe('c1');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `cd apps/mobile && bun test lib/seeker-setup.test.ts`  
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `lib/seeker-setup.ts`**

```ts
import {
  DEFAULT_SEARCH_FILTERS,
  type SearchFilters,
} from '@/lib/search-filters';
import type { PropertyMode } from '@/types/property';

export type SeekerIntent = 'RENT' | 'BUY' | 'BOTH';
export type SeekerExperience = 'FIRST_TIME' | 'RETURNING' | 'PRO';

export type SeekerPrefsLike = {
  seekerIntent: SeekerIntent | null;
  seekerExperience: SeekerExperience | null;
  budgetMinXaf: number | null;
  budgetMaxXaf: number | null;
  preferredQuartierIds: string[];
};

export type SeekerSetupDraft = {
  intent: SeekerIntent | null;
  experience: SeekerExperience | null;
  budgetMinXaf: number | null;
  budgetMaxXaf: number | null;
  preferredQuartierIds: string[];
};

export type BudgetBand = {
  id: string;
  label: string;
  min: number;
  max: number | null;
};

export const BUDGET_BANDS_RENT: BudgetBand[] = [
  { id: 'r1', label: 'Moins de 100 000', min: 0, max: 100_000 },
  { id: 'r2', label: '100 000 – 250 000', min: 100_000, max: 250_000 },
  { id: 'r3', label: '250 000 – 500 000', min: 250_000, max: 500_000 },
  { id: 'r4', label: '500 000 et plus', min: 500_000, max: null },
];

export const BUDGET_BANDS_BUY: BudgetBand[] = [
  { id: 'b1', label: 'Moins de 30 M', min: 0, max: 30_000_000 },
  { id: 'b2', label: '30 M – 80 M', min: 30_000_000, max: 80_000_000 },
  { id: 'b3', label: '80 M – 150 M', min: 80_000_000, max: 150_000_000 },
  { id: 'b4', label: '150 M et plus', min: 150_000_000, max: null },
];

/** Seed quartier display names treated as “populaires” in Brazzaville. */
export const POPULAR_QUARTIER_NAMES = [
  'Poto-Poto-Centre',
  'Bacongo-Centre',
  'Moungali-Centre',
  'Ouenzé-Centre',
  'Makélékélé-Centre',
] as const;

export function budgetBandsForIntent(
  intent: SeekerIntent | null,
): BudgetBand[] {
  if (intent === 'BUY') return BUDGET_BANDS_BUY;
  return BUDGET_BANDS_RENT;
}

export function intentToMode(intent: SeekerIntent | null): PropertyMode {
  if (intent === 'BUY') return 'SALE';
  return 'RENT_LONG';
}

export type QuartierResolve = {
  id: string;
  name: string;
  cityId: string;
  cityName: string;
};

export function seekerPrefsToSearchFilters(
  prefs: SeekerPrefsLike,
  base: SearchFilters = DEFAULT_SEARCH_FILTERS,
  opts?: {
    resolveQuartier?: (id: string) => QuartierResolve | null;
  },
): SearchFilters {
  const next: SearchFilters = {
    ...base,
    mode: prefs.seekerIntent
      ? intentToMode(prefs.seekerIntent)
      : base.mode,
    minPrice: prefs.budgetMinXaf ?? base.minPrice,
    maxPrice: prefs.budgetMaxXaf ?? base.maxPrice,
  };

  const firstId = prefs.preferredQuartierIds[0];
  if (firstId && opts?.resolveQuartier) {
    const q = opts.resolveQuartier(firstId);
    if (q) {
      next.quartierId = q.id;
      next.quartierName = q.name;
      next.cityId = q.cityId;
      next.cityName = q.cityName;
    }
  }
  return next;
}

export function emptySeekerDraft(): SeekerSetupDraft {
  return {
    intent: null,
    experience: null,
    budgetMinXaf: null,
    budgetMaxXaf: null,
    preferredQuartierIds: [],
  };
}
```

- [ ] **Step 4: Extend `locations.ts`**

```ts
export async function listQuartiersForCity(
  cityId: string,
): Promise<PublicQuartier[]> {
  const arrondissements = await listArrondissements(cityId);
  const chunks = await Promise.all(
    arrondissements.map((a) => listQuartiers(a.id)),
  );
  return chunks.flat().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
```

- [ ] **Step 5: Extend `PublicUser` / `AuthUser` / `updateMe`**

`PublicUser` add seeker fields (nullable + `preferredQuartierIds: string[]`, `seekerSetupCompletedAt: string | null`).

`AuthUser` add optional same fields for cache.

`toAuthUser` copies them.

`updateMe` body may include numbers/arrays/boolean — change body typing to `Record<string, unknown>` or a typed object passed to `apiFetch` (match how other PATCH bodies work in `api.ts`). Include:

```ts
  seekerIntent?: SeekerIntent | null;
  seekerExperience?: SeekerExperience | null;
  budgetMinXaf?: number | null;
  budgetMaxXaf?: number | null;
  preferredQuartierIds?: string[];
  completeSeekerSetup?: boolean;
```

- [ ] **Step 6: Run tests — PASS**

Run: `cd apps/mobile && bun test lib/seeker-setup.test.ts`  
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/lib/seeker-setup.ts apps/mobile/lib/seeker-setup.test.ts \
  apps/mobile/lib/users.ts apps/mobile/lib/auth.ts apps/mobile/lib/locations.ts
git commit -m "feat(mobile): seeker setup domain helpers and me types"
```

---

### Task 4: Setup shell UI + context

**Files:**
- Create: `apps/mobile/context/SeekerSetupContext.tsx`
- Create: `apps/mobile/components/setup/SetupShell.tsx`
- Create: `apps/mobile/components/setup/SetupOptionCard.tsx`

**Interfaces:**
- `useSeekerSetup()` → `{ draft, setIntent, setExperience, setBudget, setQuartiers, reset }`
- `SetupShellProps`: `{ stepIndex: 0|1|2|3; title: string; subtitle?: string; canContinue: boolean; continuing?: boolean; onSkip: () => void; onContinue: () => void; children }`

- [ ] **Step 1: Create context**

```tsx
import {
  emptySeekerDraft,
  type SeekerExperience,
  type SeekerIntent,
  type SeekerSetupDraft,
} from '@/lib/seeker-setup';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type Ctx = {
  draft: SeekerSetupDraft;
  setIntent: (v: SeekerIntent | null) => void;
  setExperience: (v: SeekerExperience | null) => void;
  setBudget: (min: number | null, max: number | null) => void;
  setQuartiers: (ids: string[]) => void;
  reset: () => void;
};

const SeekerSetupContext = createContext<Ctx | null>(null);

export function SeekerSetupProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [draft, setDraft] = useState<SeekerSetupDraft>(emptySeekerDraft);

  const value = useMemo<Ctx>(
    () => ({
      draft,
      setIntent: (intent) => setDraft((d) => ({ ...d, intent })),
      setExperience: (experience) => setDraft((d) => ({ ...d, experience })),
      setBudget: (budgetMinXaf, budgetMaxXaf) =>
        setDraft((d) => ({ ...d, budgetMinXaf, budgetMaxXaf })),
      setQuartiers: (preferredQuartierIds) =>
        setDraft((d) => ({
          ...d,
          preferredQuartierIds: preferredQuartierIds.slice(0, 3),
        })),
      reset: () => setDraft(emptySeekerDraft()),
    }),
    [draft],
  );

  return (
    <SeekerSetupContext.Provider value={value}>
      {children}
    </SeekerSetupContext.Provider>
  );
}

export function useSeekerSetup(): Ctx {
  const ctx = useContext(SeekerSetupContext);
  if (!ctx) {
    throw new Error('useSeekerSetup must be used within SeekerSetupProvider');
  }
  return ctx;
}
```

- [ ] **Step 2: Implement `SetupOptionCard`**

Card: `minHeight` ~120, `borderRadius: radii.xl`, surface bg, border; selected → `borderColor: colors.primary` + check circle top-right; icon circle + label bottom-left. Props: `label`, `icon` (Ionicons name), `selected`, `onPress`.

- [ ] **Step 3: Implement `SetupShell`**

- Top row: 4 progress segments (`flex:1`, height 3, radius full; active/filled = `colors.primary`, else `colors.border`) + Skip text button (`colors.muted`)
- Title (`fontSize` 28, weight 800) + optional subtitle
- `children` in scroll
- Bottom Continue pill (disabled opacity 0.45 when `!canContinue || continuing`)

Use `colors`, `spacing`, `radii`, safe area insets.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/context/SeekerSetupContext.tsx \
  apps/mobile/components/setup
git commit -m "feat(mobile): seeker setup shell and context"
```

---

### Task 5: Setup screens + finish persist

**Files:**
- Create: `apps/mobile/app/(auth)/setup/_layout.tsx`
- Create: `apps/mobile/app/(auth)/setup/intent.tsx`
- Create: `apps/mobile/app/(auth)/setup/experience.tsx`
- Create: `apps/mobile/app/(auth)/setup/budget.tsx`
- Create: `apps/mobile/app/(auth)/setup/neighborhoods.tsx`
- Create: `apps/mobile/lib/seeker-setup-persist.ts` (optional thin helper)
- Modify: `apps/mobile/app/(auth)/otp-verify.tsx`
- Modify: `apps/mobile/app/_layout.tsx`

**Interfaces:**
- `persistSeekerSetupAndSync(draft: SeekerSetupDraft): Promise<void>` → `updateMeAndSync` with mapped fields + `completeSeekerSetup: true`
- OTP register → `router.replace('/(auth)/setup/intent')`

- [ ] **Step 1: `_layout.tsx`**

```tsx
import { SeekerSetupProvider } from '@/context/SeekerSetupContext';
import { Stack } from 'expo-router';

export default function SetupLayout(): React.JSX.Element {
  return (
    <SeekerSetupProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </SeekerSetupProvider>
  );
}
```

- [ ] **Step 2: `intent.tsx`**

Options (grid 2 cols if 3 cards — third full width or 2+1):
- Louer / `RENT` / `home-outline`
- Acheter / `BUY` / `key-outline`
- Les deux / `BOTH` / `options-outline`

Skip → clear intent + `router.push('./experience')`  
Continue → requires `draft.intent` → `./experience`

- [ ] **Step 3: `experience.tsx`**

- Première fois / `FIRST_TIME` / `sparkles-outline`
- Déjà cherché / `RETURNING` / `search-outline`
- Je m’y connais / `PRO` / `ribbon-outline`

Navigate to `./budget`

- [ ] **Step 4: `budget.tsx`**

Use `budgetBandsForIntent(draft.intent)` as exclusive chips/cards. Selecting sets min/max via `setBudget`. Skip clears budget. Navigate to `./neighborhoods`.

- [ ] **Step 5: `neighborhoods.tsx` + persist helper**

On mount:
1. `listCities('CG')` → find Brazzaville (case-insensitive name match)
2. `listQuartiersForCity(city.id)`
3. Split popular = names in `POPULAR_QUARTIER_NAMES` that exist; rest searchable

UI: search input, popular section, full list; toggle id in `preferredQuartierIds` (max 3 — ignore add if already 3 and not selected).

`finish` async:
```ts
await updateMeAndSync({
  seekerIntent: draft.intent ?? undefined,
  seekerExperience: draft.experience ?? undefined,
  budgetMinXaf: draft.budgetMinXaf ?? undefined,
  budgetMaxXaf: draft.budgetMaxXaf ?? undefined,
  preferredQuartierIds: draft.preferredQuartierIds,
  completeSeekerSetup: true,
});
router.replace('/(auth)/personnal-infos');
```

On error: `showFeedback` error; stay on screen; Continue/Skip retryable.  
Skip on this step = `setQuartiers([])` then same `finish`.

- [ ] **Step 6: Wire OTP + root layout**

In `otp-verify.tsx` `submit` success:
```ts
if (flow === 'register') {
  router.replace('/(auth)/setup/intent');
} else if (needsProfile) {
  router.replace('/(auth)/personnal-infos');
} else {
  router.replace('/(tabs)');
}
```

In `app/_layout.tsx`, add:
```tsx
<Stack.Screen
  name="(auth)/setup"
  options={{ animation: 'slide_from_right' }}
/>
```

- [ ] **Step 7: Manual smoke**

Register flow on device/simulator: OTP → intent → … → name → home. Skip-all still reaches name after PATCH.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/app/\(auth\)/setup apps/mobile/app/\(auth\)/otp-verify.tsx \
  apps/mobile/app/_layout.tsx apps/mobile/lib/seeker-setup-persist.ts
git commit -m "feat(mobile): seeker setup wizard screens and register wiring"
```

---

### Task 6: Seed search defaults from seeker prefs

**Files:**
- Modify: `apps/mobile/app/search.tsx` (and/or home entry that opens search)
- Optionally: `apps/mobile/app/(tabs)/index.tsx` if home owns mode state

**Interfaces:**
- Consumes: `fetchMe` / stored user seeker fields + `seekerPrefsToSearchFilters`

- [ ] **Step 1: When search opens with empty filter params**

If `params` have no mode/city/price/quartier keys, load prefs:

```ts
const stored = await getStoredUser();
// if AuthUser lacks fields, fetchMe() once
const seeded = seekerPrefsToSearchFilters({
  seekerIntent: me.seekerIntent,
  seekerExperience: me.seekerExperience,
  budgetMinXaf: me.budgetMinXaf,
  budgetMaxXaf: me.budgetMaxXaf,
  preferredQuartierIds: me.preferredQuartierIds ?? [],
}, DEFAULT_SEARCH_FILTERS, { resolveQuartier });
```

Apply by `router.setParams(filtersToParams(seeded))` **only when** incoming params are empty (avoid overriding user-chosen filters). Resolve quartier via in-memory map built from `listQuartiersForCity` after resolving Brazzaville (or skip name resolve and set id only if name unknown — prefer full resolve).

- [ ] **Step 2: Smoke**

Complete wizard with Louer + a budget + 1 quartier → open Search → filters reflect prefs.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app/search.tsx apps/mobile/app/\(tabs\)/index.tsx
git commit -m "feat(mobile): seed search filters from seeker setup prefs"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Register → setup → personnal-infos | 5 |
| 4 steps + Skip/Continue | 4–5 |
| API fields + PATCH + completedAt | 1–2 |
| Max 3 quartiers / validation | 2, 5 |
| Brand violet UI shell | 4 |
| Brazzaville + popular list | 3, 5 |
| Block exit on PATCH fail | 5 |
| Seed search defaults | 6 |
| No login force / no GPS | respected (out of scope) |

## Placeholder / consistency notes

- DTO uses `completeSeekerSetup: boolean` (server sets timestamp) — mobile must send this, not a client Date
- `BOTH` → `RENT_LONG` in mapper (matches spec)
- First preferred quartier seeds filters (matches spec)
