# Mobile Seeker Setup Wizard (post-register) — Design Spec

**Date:** 2026-07-12  
**Status:** Approved for planning  
**Scope:** Multistep preference wizard after account creation (register OTP), before personal name screen; API persistence on `User`; light home/search seeding from prefs.

## Goal

After a new seeker creates an account, collect **intent + search preferences** so the app can personalize mode, budget, and neighborhood defaults — without blocking signup (Skip everywhere).

## Decisions (locked)

| Topic | Choice |
|--------|--------|
| Purpose | Intent qualification **and** search preferences |
| Trigger | After **register** OTP only, **before** `personnal-infos` |
| Steps | Intent → Experience → Budget → Quartiers (max 3) → then name |
| Storage | API on `User` via `PATCH /users/me` |
| Visual | Existing Paradis Immo tokens (violet); structure inspired by reference mockups |
| Architecture | Expo Router setup stack + in-memory draft; single PATCH on exit |

## Out of scope (MVP)

- Login-forced wizard for legacy users without prefs
- Edit prefs from profile (« Compléter mes préférences »)
- GPS / « Use my current location »
- Server-side ranking / ML personalization
- Lime accent or forced-dark-only wizard theme

## Flow

```
Register phone → OTP verify (flow=register)
  → /(auth)/setup/*  (4 steps)
  → PATCH /users/me (draft + seekerSetupCompletedAt)
  → /(auth)/personnal-infos
  → /(tabs)
```

**Login:** unchanged. Missing name still goes to `personnal-infos` only. Wizard is **not** shown on login in MVP.

### Navigation structure

```
app/(auth)/setup/
  _layout.tsx           # SeekerSetupProvider + SetupShell chrome
  intent.tsx
  experience.tsx
  budget.tsx
  neighborhoods.tsx
```

OTP success (`flow === 'register'`) navigates to `/(auth)/setup/intent` instead of `personnal-infos`.  
Existing path `register || needsProfile → personnal-infos` becomes: register → setup; needsProfile (login) → personnal-infos.

### Shell behavior

- Progress: 4 segments, filled with `colors.primary`
- **Skip:** set current step value to `null` (or empty quartiers), advance; on last step → exit wizard (persist)
- **Continue:** requires a selection on intent / experience / budget; neighborhoods allow 0–3 then continue
- Optional back to previous setup step (draft kept); does not leave the setup stack until exit
- Persist **once** on wizard exit (Skip or Continue on last step, or explicit finish), including all-null draft, always setting `seekerSetupCompletedAt`

## UI

Shared components (auth/setup):

- `SetupShell` — safe area, progress, Skip, content slot, Continue CTA (pill primary / onPrimary)
- `SetupOptionCard` — selectable card (grid); selected = primary border + check badge
- Budget = exclusive chips/tranches
- Neighborhoods = search field + « Populaires » list + multi-select (max 3)

Copy (FR):

| Step | Title | Options |
|------|--------|---------|
| Intent | Quel est votre objectif ? | Louer · Acheter · Les deux |
| Experience | Où en êtes-vous dans votre recherche ? | Première fois · Déjà cherché · Je m’y connais |
| Budget | Quel budget visez-vous ? | Intent-dependent XAF ranges (rent vs sale) |
| Quartiers | Quels quartiers vous intéressent ? | Subtitle: jusqu’à 3; default city Brazzaville |

Light/dark via existing `colors.*` only.

## Data model (Prisma `User`)

| Field | Type | Notes |
|--------|------|--------|
| `seekerIntent` | `SeekerIntent?` enum `RENT` \| `BUY` \| `BOTH` | |
| `seekerExperience` | `SeekerExperience?` enum `FIRST_TIME` \| `RETURNING` \| `PRO` | |
| `budgetMinXaf` | `Int?` | Lower bound of selected tranche |
| `budgetMaxXaf` | `Int?` | Upper bound; `null` means « et plus » when min set |
| `preferredQuartierIds` | `String[]` `@default([])` | Max 3 Quartier ids |
| `seekerSetupCompletedAt` | `DateTime?` | Non-null ⇒ wizard already finished for this user |

### API

- Extend `GET /users/me` response and `UpdateMeDto` / `UsersService.updateMe`
- Validation: `preferredQuartierIds.length ≤ 3`; ids must exist; if both budget bounds set, `min ≤ max`
- Wizard exit: one `PATCH` with draft fields + `seekerSetupCompletedAt: <now>` (ISO / server `now()`)

Mobile: sync stored auth user from `me` after successful PATCH (same pattern as profile edit / personnal-infos).

### Neighborhoods loading

- Default city: Brazzaville (existing seed)
- Load via locations cascade (city → arrondissements → quartiers)
- « Populaires »: curated subset of seed quartier ids/names (MVP constant)
- Search filters the merged list client-side

## Post-setup consumption (MVP)

After prefs are on the user:

- On home / search bootstrap, map:
  - `seekerIntent` → default `SearchFilters.mode` (`RENT`→`RENT_LONG`, `BUY`→`SALE`, `BOTH`→`RENT_LONG`)
  - budget → `minPrice` / `maxPrice`
  - if `preferredQuartierIds` is non-empty → seed filters from the **first** id (resolve name via locations cache); remaining ids kept on the user for later use
- No ranking changes beyond filter defaults

## Edge cases & errors

| Case | Behavior |
|------|----------|
| App killed mid-wizard | Draft lost; if register session returns and `seekerSetupCompletedAt` is null, show setup from step 1 again |
| Legacy users (no setup) | Do not force wizard on login |
| PATCH fails on exit | Error feedback; stay on exit step with retry; **do not** navigate to `personnal-infos` until save succeeds |
| Quartiers API failure | Empty list + message; Skip/Continue still work |

## Testing

**API**

- `updateMe` accepts seeker fields and sets `seekerSetupCompletedAt`
- Rejects >3 quartier ids / unknown ids / invalid budget order

**Mobile**

- Register OTP → setup intent (not personnal-infos)
- Skip-all still PATCHes completedAt then reaches personnal-infos
- Continue disabled on intent/experience/budget without selection
- Successful exit seeds filters from stored user (unit or light integration)

## File touchpoints (expected)

- `apps/api/prisma/schema.prisma` + migration
- `apps/api/src/users/*` (dto, service, specs)
- `apps/mobile/app/(auth)/otp-verify.tsx` (register → setup)
- `apps/mobile/app/(auth)/setup/**`
- `apps/mobile/components/setup/**` (shell + cards)
- `apps/mobile/lib/users.ts` / auth user type sync
- Home/search default seeding from user prefs
