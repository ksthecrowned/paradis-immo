# Court séjour — règles de séjour (P2-12 V1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RENT_SHORT properties carry min/max nights and optional check-in/out times; bookings reject stays outside night bounds; UIs show rules and surface FR errors.

**Architecture:** Four nullable columns on `Property`. Validate on property create/update when mode is RENT_SHORT. Reuse existing `BookingsService.computeNights` for `STAY_TOO_SHORT` / `STAY_TOO_LONG`. Clients: owner form fields + Conditions block on public/mobile detail + booking error mapping.

**Tech Stack:** NestJS + Prisma, Next.js owner/web, Expo mobile, Jest.

**Spec:** `docs/superpowers/specs/2026-09-03-short-stay-rules-design.md`

## Global Constraints

- Fields: `minNights` (required if RENT_SHORT, ≥1), `maxNights` (optional, ≥ min), `checkInTime` / `checkOutTime` (optional `HH:mm`, display only).
- Other modes: fields forced `null`.
- Booking errors: `STAY_TOO_SHORT` / `STAY_TOO_LONG` with `minNights` / `maxNights` in exception body when relevant.
- Night count = existing `computeNights(start, end)` — do not invent a second formula.
- No capacity / guestCount / check-in ops.
- Commits: only if the user asks.

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | 4 columns on Property |
| `apps/api/prisma/migrations/20260903140000_short_stay_rules/migration.sql` | Add columns + backfill minNights=1 for RENT_SHORT |
| `apps/api/src/properties/dto/create-property.dto.ts` | DTO fields + validators |
| `apps/api/src/properties/properties.service.ts` | Write validation + serialize + clear on non-short |
| `apps/api/src/properties/properties.spec.ts` | Property create/update cases |
| `apps/api/src/bookings/bookings.service.ts` | Night-bound checks |
| `apps/api/src/bookings/bookings.spec.ts` (or create if missing) | STAY_TOO_* tests |
| `apps/web/lib/owner/properties.ts` | Types + payloads |
| `apps/web/app/owner/properties/owner-property-form.tsx` | Form fields |
| Public property detail component(s) web | Conditions block |
| `apps/mobile/lib/properties.ts` / types | Types |
| Mobile property detail | Conditions block |
| Mobile/web booking create error handling | FR messages |
| `TODOS.md` | P2-12 V1 ✅ |

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260903140000_short_stay_rules/migration.sql`

**Interfaces:**
- Produces: `Property.minNights`, `maxNights`, `checkInTime`, `checkOutTime`

- [ ] **Step 1: Add columns** near other Property scalars (after `bedrooms` or similar):

```prisma
  minNights    Int?
  maxNights    Int?
  checkInTime  String?  // "HH:mm"
  checkOutTime String?
```

- [ ] **Step 2: Migration SQL**

```sql
ALTER TABLE "Property" ADD COLUMN "minNights" INTEGER,
ADD COLUMN "maxNights" INTEGER,
ADD COLUMN "checkInTime" TEXT,
ADD COLUMN "checkOutTime" TEXT;

UPDATE "Property" SET "minNights" = 1 WHERE mode = 'RENT_SHORT' AND "minNights" IS NULL;
```

- [ ] **Step 3: Apply**

```bash
cd apps/api && bunx prisma migrate deploy && bunx prisma generate
```

- [ ] **Step 4: Commit** (si demandé)

---

### Task 2: Property DTOs + service validation (TDD)

**Files:**
- Modify: `apps/api/src/properties/dto/create-property.dto.ts` (`CreatePropertyDto` + `UpdatePropertyDto`)
- Modify: `apps/api/src/properties/properties.service.ts` (create, update, `toPublic` / serialize)
- Modify: `apps/api/src/properties/properties.spec.ts`

**Interfaces:**
- Consumes: mode after resolve
- Produces: PublicProperty includes the 4 fields (`number | null` / `string | null`)
- Helper (private in service or small util):

```ts
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function assertShortStayFields(input: {
  mode: string;
  minNights?: number | null;
  maxNights?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}): { minNights: number | null; maxNights: number | null; checkInTime: string | null; checkOutTime: string | null } {
  if (input.mode !== 'RENT_SHORT') {
    return { minNights: null, maxNights: null, checkInTime: null, checkOutTime: null };
  }
  if (input.minNights == null || !Number.isInteger(input.minNights) || input.minNights < 1) {
    throw new BadRequestException({ code: 'MIN_NIGHTS_REQUIRED', message: 'minNights (≥ 1) is required for RENT_SHORT' });
  }
  if (input.maxNights != null && (input.maxNights < input.minNights || !Number.isInteger(input.maxNights))) {
    throw new BadRequestException({ code: 'INVALID_MAX_NIGHTS', message: 'maxNights must be ≥ minNights' });
  }
  for (const [key, value] of [['checkInTime', input.checkInTime], ['checkOutTime', input.checkOutTime]] as const) {
    if (value != null && !HH_MM.test(value)) {
      throw new BadRequestException({ code: 'INVALID_CHECK_TIME', message: `${key} must be HH:mm` });
    }
  }
  return {
    minNights: input.minNights,
    maxNights: input.maxNights ?? null,
    checkInTime: input.checkInTime ?? null,
    checkOutTime: input.checkOutTime ?? null,
  };
}
```

- [ ] **Step 1: Failing tests** in `properties.spec.ts`
  - create RENT_SHORT without minNights → 400 `MIN_NIGHTS_REQUIRED`
  - create RENT_SHORT min=2 max=1 → `INVALID_MAX_NIGHTS`
  - create RENT_SHORT checkInTime `25:00` → `INVALID_CHECK_TIME`
  - create RENT_SHORT valid → fields persisted + public payload
  - create RENT_LONG with minNights sent → stored as null
  - update mode SALE from RENT_SHORT → clears short-stay fields

- [ ] **Step 2: Run FAIL**

```bash
cd apps/api && bunx jest src/properties/properties.spec.ts --forceExit
```

- [ ] **Step 3: Implement** DTO optional `@IsInt @Min(1)` etc. + service assert on create/update + serialize fields.

- [ ] **Step 4: Run PASS**

- [ ] **Step 5: Commit** (si demandé)

---

### Task 3: Bookings night bounds (TDD)

**Files:**
- Modify: `apps/api/src/bookings/bookings.service.ts`
- Modify or create: `apps/api/src/bookings/bookings.spec.ts` (follow existing booking test patterns if any; else Nest+Prisma like other specs)

**Interfaces:**
- After loading property, before overlap / create:

```ts
const minNights = property.minNights ?? 1;
const nights = this.computeNights(input.startDate, input.endDate);
if (nights < minNights) {
  throw new BadRequestException({
    code: 'STAY_TOO_SHORT',
    message: `Séjour trop court (minimum ${minNights} nuit(s))`,
    minNights,
  });
}
if (property.maxNights != null && nights > property.maxNights) {
  throw new BadRequestException({
    code: 'STAY_TOO_LONG',
    message: `Séjour trop long (maximum ${property.maxNights} nuit(s))`,
    maxNights: property.maxNights,
  });
}
```

Extend `findUnique` select to include `minNights`, `maxNights`.

- [ ] **Step 1: Failing tests**
  - property minNights=2, book 1 night → `STAY_TOO_SHORT`
  - maxNights=7, book 10 nights → `STAY_TOO_LONG`
  - within bounds → success (existing happy path)
  - times set do not affect acceptance

- [ ] **Step 2: FAIL then implement then PASS**

```bash
cd apps/api && bunx jest src/bookings --forceExit
```

- [ ] **Step 3: Commit** (si demandé)

---

### Task 4: Web owner form + public Conditions

**Files:**
- Modify: `apps/web/lib/owner/properties.ts` (types Create/Update/Public)
- Modify: `apps/web/app/owner/properties/owner-property-form.tsx`
- Modify: public listing detail component that renders property (find existing property detail / listing page under `apps/web`)
- Modify: `apps/web/app/owner/bookings/owner-bookings.tsx` (map API error codes to FR if not already via ApiError.message — API already sends FR message)

**UI:**
- When `mode === 'RENT_SHORT'`: show Min nuits (required), Max nuits, Check-in, Check-out.
- When mode changes away from RENT_SHORT: clear those form fields.
- Public detail: if RENT_SHORT, block **Conditions** with min/max/times.

- [ ] **Step 1: Types + form**
- [ ] **Step 2: Public Conditions**
- [ ] **Step 3: Smoke note** in report if manual
- [ ] **Step 4: Commit** (si demandé)

---

### Task 5: Mobile types + Conditions + book errors

**Files:**
- Modify: `apps/mobile/lib/properties.ts` and/or `apps/mobile/types/property.ts`
- Modify: property detail UI (`apps/mobile/app/property/[id]/index.tsx` or a detail subcomponent)
- Modify: `apps/mobile/app/property/[id]/book.tsx` — catch `STAY_TOO_SHORT` / `STAY_TOO_LONG` (prefer API message)

- [ ] **Step 1: Types**
- [ ] **Step 2: Conditions block**
- [ ] **Step 3: Book error UX**
- [ ] **Step 4: Commit** (si demandé)

---

### Task 6: TODOS + verify

**Files:**
- Modify: `TODOS.md`

- [ ] **Step 1: Update P2-12**

| # | Item | Accès | Statut |
|---|------|-------|--------|
| 12.0 | Spec règles séjour RENT_SHORT | 🟡 | ✅ |
| 12.1 | Property fields + booking bounds | 🔴 | ✅ |
| 12.2 | Web owner + Conditions | 🟡 | ✅ |
| 12.3 | Mobile Conditions + book errors | 🟡 | ✅ |

Focus: P2-12 V1 livré ; plus tard check-in ops / couchages si besoin.

- [ ] **Step 2: Final tests**

```bash
cd apps/api && bunx jest src/properties/properties.spec.ts src/bookings --forceExit
```

- [ ] **Step 3: Commit** (si demandé)

---

## Spec coverage

| Spec | Task |
|------|------|
| Columns + backfill | 1 |
| Write validation + public serialize | 2 |
| Booking STAY_TOO_* | 3 |
| Owner form + web Conditions | 4 |
| Mobile Conditions + errors | 5 |
| TODOS | 6 |

## Hors plan

- Capacité / couchages
- Check-in opérationnel
- Org-level defaults
- Timezone-aware check-in enforcement
