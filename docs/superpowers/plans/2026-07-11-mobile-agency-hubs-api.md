# Mobile Agency Hubs API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich `Organization` with hub marketing fields, expose public `GET /organizations` (+ detail with agents), seed Paradis + 2 partner agencies, and wire mobile hubs/home/filters/chips to the API — reviews stay mock; no UI chrome removed.

**Architecture:** Prisma columns on `Organization`. New Nest controller under `organizations`. Mobile `mapPublicOrganization` / `mapPublicAgent` + `lib/agencies.ts` replace `mock-agencies` as source of truth. Hub Biens use existing `GET /properties?organizationId=`.

**Tech Stack:** NestJS, Prisma, Expo, Bun tests, existing `apiFetch` / `lib/properties.ts` / `lib/catalog.ts`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-mobile-agency-hubs-api-design.md`
- French copy only; never remove hub/chip UI blocks (defaults inside existing UI)
- `PublicAgent.id` = `User.id` (same as `PublicProperty.agent.id`)
- Public list: `(type = AGENCY) OR (isOfficial = true)` — no OWNER orgs
- Paradis stays `PLATFORM` + `isOfficial: true`; properties stay on Paradis
- Conversion / leases / payments out of scope

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Organization marketing columns |
| `apps/api/prisma/migrations/…` | Migration SQL |
| `apps/api/src/common/constants/seed-ids.ts` | Partner org + agent user UUIDs |
| `apps/api/prisma/seed.ts` | Marketing fields + 2 agencies + agents |
| `apps/api/src/organizations/organizations.service.ts` | `listPublic` / `getPublic` + `toPublic` |
| `apps/api/src/organizations/organizations.controller.ts` | Public routes |
| `apps/api/src/organizations/organizations.module.ts` | Register controller |
| `apps/api/src/organizations/organizations.public.spec.ts` | API shape tests |
| `apps/mobile/lib/map-organization.ts` | API → `Agency` / `Agent` |
| `apps/mobile/lib/map-organization.test.ts` | Adapter tests |
| `apps/mobile/lib/agencies.ts` | Fetch/list/get + in-memory cache |
| `apps/mobile/lib/mock-agency-reviews.ts` | Reviews keyed by seed org UUIDs |
| `apps/mobile/app/agency/[id].tsx` | Hub from API |
| `apps/mobile/app/(tabs)/index.tsx` | Home agency row |
| `apps/mobile/app/filters.tsx` | Agency filter chips |
| `apps/mobile/components/agency/AgencyChip.tsx` | Resolve via agencies cache |
| `apps/mobile/components/agency/AgentRow.tsx` | Prefer live agent + fallbacks |
| `apps/mobile/lib/mock-agencies.ts` | Deprecate exports used by above (keep until greps clean; or thin re-exports) |

---

### Task 1: Prisma Organization marketing fields

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`model Organization`)
- Create: migration via `prisma migrate`

**Add to `Organization`:**

```prisma
  shortName          String?
  tagline            String?
  address            String?
  phone              String?
  cityLabel          String?
  logoColor          String?
  isOfficial         Boolean  @default(false)
  verified           Boolean  @default(false)
  foundedYear        Int?
  rating             Float?
  reviewCount        Int      @default(0)
  dealSuccessPercent Int?
```

- [ ] **Step 1:** Edit schema as above (after `affiliationStatus`, before `countryId` is fine)

- [ ] **Step 2:** Migrate

```bash
cd apps/api && bunx prisma migrate dev --name organization_hub_fields
```

Expected: migration applied, client generated

- [ ] **Step 3:** Commit

```bash
git add apps/api/prisma
git commit -m "feat(api): add organization hub marketing fields"
```

---

### Task 2: Seed IDs + partner orgs + marketing

**Files:**
- Modify: `apps/api/src/common/constants/seed-ids.ts`
- Modify: `apps/api/prisma/seed.ts`

**Add to `SEED_IDS`:**

```ts
  orgCoteSauvage: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // replace with real random UUIDs
  orgHabitatPn: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  userAgentParadis2: '…',
  userAgentCote: '…',
  userAgentHabitat: '…',
```

Use freshly generated UUIDs (same style as existing entries). Do not reuse placeholder strings above — generate with `bun -e "console.log(crypto.randomUUID())"` five times.

**Seed behavior:**

1. When upserting Paradis org, set:
   - `name: 'Agence Paradis Immo'`
   - `shortName: 'Paradis Immo'`
   - `tagline: 'L'agence officielle de la plateforme'`
   - `address: 'Centre-ville, Pointe-Noire'`
   - `phone: '+242 06 500 00 00'`
   - `cityLabel: 'Pointe-Noire'`
   - `logoColor: '#7065F0'`
   - `isOfficial: true`, `verified: true`
   - `foundedYear: 2012`, `rating: 4.9`, `reviewCount: 128`, `dealSuccessPercent: 94`

2. Create/upsert Côte Sauvage (`AGENCY`) and Habitat PN (`AGENCY`) with mock marketing (teal `#0F766E`, amber `#B45309`).

3. Ensure ≥2 AGENT members on Paradis (`userAgent` + `userAgentParadis2`) and ≥1 AGENT on each partner org.

4. Do **not** move the four seed properties off Paradis.

- [ ] **Step 1:** Add SEED_IDS UUIDs

- [ ] **Step 2:** Patch seed.ts as above

- [ ] **Step 3:** `cd apps/api && bun run prisma:seed` — expect success

- [ ] **Step 4:** Commit

```bash
git commit -m "feat(api): seed agency hub marketing and partner orgs"
```

---

### Task 3: Public organizations API

**Files:**
- Modify: `apps/api/src/organizations/organizations.service.ts`
- Create: `apps/api/src/organizations/organizations.controller.ts`
- Modify: `apps/api/src/organizations/organizations.module.ts`
- Create: `apps/api/src/organizations/organizations.public.spec.ts` (or extend existing spec)

**Interfaces:**

```ts
export type PublicOrganization = {
  id: string;
  name: string;
  type: string;
  shortName: string | null;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  cityLabel: string | null;
  logoColor: string | null;
  isOfficial: boolean;
  verified: boolean;
  foundedYear: number | null;
  rating: number | null;
  reviewCount: number;
  dealSuccessPercent: number | null;
};

export type PublicAgent = {
  id: string;
  organizationId: string;
  name: string | null;
  phone: string | null;
};

export type PublicOrganizationDetail = PublicOrganization & {
  agents: PublicAgent[];
};
```

**Service methods:**

```ts
async listPublic(): Promise<{ data: PublicOrganization[] }>
async getPublic(id: string): Promise<PublicOrganizationDetail> // NotFound if not public
```

Public where: `{ OR: [{ type: 'AGENCY' }, { isOfficial: true }] }`  
Order: `[{ isOfficial: 'desc' }, { name: 'asc' }]`  
Agents: members `role: AGENT`, map `id: member.user.id`.

**Controller:**

```ts
@ApiTags('Organizations')
@Controller('organizations')
export class OrganizationsController {
  @Get() list() { return this.orgs.listPublic(); }
  @Get(':id') get(@Param('id') id: string) { return this.orgs.getPublic(id); }
}
```

Register controller in module (keep `@Global()` + exports).

- [ ] **Step 1:** Write failing unit test asserting `toPublic` / list filter excludes OWNER (mock prisma or service helpers)

- [ ] **Step 2:** Implement service + controller + module wiring

- [ ] **Step 3:** Run `cd apps/api && bun test src/organizations` — expect pass

- [ ] **Step 4:** Commit

```bash
git commit -m "feat(api): public GET /organizations list and detail"
```

---

### Task 4: Mobile map-organization + agencies client

**Files:**
- Create: `apps/mobile/lib/map-organization.ts`
- Create: `apps/mobile/lib/map-organization.test.ts`
- Create: `apps/mobile/lib/agencies.ts`
- Create: `apps/mobile/lib/mock-agency-reviews.ts` (move review data from mock-agencies; key by `SEED`-style UUIDs — hardcode the three org UUIDs from `seed-ids` after Task 2)

**Types** (keep existing from `mock-agencies` — either re-export `Agency`/`Agent` from `agencies.ts` or from a thin `types` import; prefer export types from `lib/agencies.ts` and update imports):

```ts
export function mapPublicOrganization(api: PublicOrganization): Agency
export function mapPublicAgent(api: PublicAgent): Agent
```

Defaults: `shortName ← name`, `logoColor ← '#7065F0'`, `tagline ← ''`, `city ← cityLabel ?? 'Pointe-Noire'`, `address/phone ← ''`, `rating/reviewCount/dealSuccessPercent ← 0`, `foundedYear ← 2012` only if type requires number (Agency.foundedYear is required today — use `api.foundedYear ?? 2012` as documented UI default, not fake history claim in copy).

Agent defaults: `displayName ← name ?? 'Conseiller'`, initials from name, `role: 'Conseiller'`, `specialty: 'Immobilier'`, `yearsExperience: 1`.

**`lib/agencies.ts`:**

```ts
export async function fetchAgencies(): Promise<Agency[]>
export async function fetchAgency(id: string): Promise<Agency & { agents: Agent[] }>
export function getCachedAgency(id: string): Agency | undefined
export function listCachedAgencies(): Agency[]
export function listCachedAgentsByAgency(agencyId: string): Agent[]
```

Use `apiFetch` like `lib/properties.ts`. On fetch, update module-level Map cache so `AgencyChip` can sync-read after home prefetch.

- [ ] **Step 1:** Write `map-organization.test.ts` (official mapping + null defaults)

- [ ] **Step 2:** Implement mapper + agencies client + mock reviews keyed by real org UUIDs

- [ ] **Step 3:** `bun test apps/mobile/lib/map-organization.test.ts` — pass

- [ ] **Step 4:** Commit

```bash
git commit -m "feat(mobile): map organizations and agencies API client"
```

---

### Task 5: Wire hub + home + filters + chips

**Files:**
- Modify: `apps/mobile/app/agency/[id].tsx`
- Modify: `apps/mobile/app/(tabs)/index.tsx`
- Modify: `apps/mobile/app/filters.tsx`
- Modify: `apps/mobile/components/agency/AgencyChip.tsx`
- Modify: `apps/mobile/components/agency/AgentRow.tsx`
- Modify: remaining greps of `getAgency` / `listAgencies` from `mock-agencies` (property detail trust chip, payment/visit if they only need display — use cache + `agencyName` fallback; do not break conversion mocks)

**Hub:**

```ts
useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      setLoading(true);
      const detail = await fetchAgency(agencyId);
      const props = await fetchCatalogProperties({ organizationId: agencyId });
      if (!cancelled) { setAgency(detail); setAgents(detail.agents); setProperties(props); }
    } catch (e) { if (!cancelled) setError(...); }
    finally { if (!cancelled) setLoading(false); }
  })();
  return () => { cancelled = true; };
}, [agencyId]);
```

Filter Biens by `selectedAgentId` using `property.agentId`.  
Avis: `listAgencyReviews(agencyId)` from mock-agency-reviews.  
Empty Biens: French « Aucun bien pour cette agence ».

**Home / filters:** `fetchAgencies()` on mount; show loading row; keep Official first (API order).

**AgencyChip:** `getCachedAgency(agencyId)` — if missing, render chip from optional props or minimal fallback `{ shortName: 'Agence', logoColor: '#7065F0' }` so chip never returns `null` when `agencyId` is present (spec: don't remove UI). Prefer: if no cache, still show a chip with letter « A » and navigate to `/agency/${agencyId}`.

**AgentRow:** try `listCachedAgents` / get agent by id; else existing `fallbackName` / `fallbackPhone`.

- [ ] **Step 1:** Wire hub screen

- [ ] **Step 2:** Wire home + filters + AgencyChip + AgentRow + trust chip paths

- [ ] **Step 3:** Grep `from '@/lib/mock-agencies'` — only reviews or unused; remove dead imports

- [ ] **Step 4:** Commit

```bash
git commit -m "feat(mobile): wire agency hubs home and filters to API"
```

---

### Task 6: Acceptance smoke

- [ ] **Step 1:** API running; `GET /api/v1/organizations` returns 3 orgs, Paradis first with `isOfficial: true`

- [ ] **Step 2:** `GET /organizations/:orgParadisImmo` includes ≥2 agents

- [ ] **Step 3:** Mobile: home agency row live; open Paradis hub → 4 Biens; open partner hub → empty Biens; Avis ok

- [ ] **Step 4:** From property detail, agency chip opens correct UUID hub

- [ ] **Step 5:** Final commit only if leftover fixes; otherwise done

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Organization columns | 1 |
| Seed Paradis + 2 agencies, props on Paradis | 2 |
| GET list + detail + agents | 3 |
| map + agencies client + mock reviews | 4 |
| Hub / home / filters / chips | 5 |
| Acceptance | 6 |
