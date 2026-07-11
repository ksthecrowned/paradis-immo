# Mobile Agency Hubs API Integration — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** Wire mobile agency discovery (home row, search filters, chips, `/agency/[id]`) to a public Nest organizations API, enriching `Organization` with hub marketing fields. Reviews stay mock. **No visual element may be removed** when data is missing.

## Goal

Replace `mock-agencies` as the source of truth for agency list/hub/chips with live `GET /organizations` (+ detail with agents), after extending Prisma `Organization` with the fields the hub UI already shows. Seed Paradis (official) + two partner agencies; keep the four seed properties on Paradis only.

## Constraints

- French copy only; brand / hub layout unchanged (`#7065F0`, light theme)
- **Never remove a UI block** because the API lacks a field — enrich Organization or keep static/default so the same blocks still render
- Catalog already maps `Property.agencyId` → `organization.id` (real UUIDs); hubs must use those IDs
- Auth OTP, conversion, leases, payments out of scope
- `GET /properties?organizationId=` already exists — reuse for hub Biens

## Decisions

| Topic | Choice |
|-------|--------|
| Slice | Agency hubs only (not tenant flows) |
| Gap policy | Enrich Organization in Prisma (option 2); reviews stay mock |
| Seed | 3 public agencies; properties stay on Paradis (option B) |
| Architecture | Approach 1: public `/organizations` + enriched model |
| Paradis type | Keep `OrganizationType.PLATFORM` + `isOfficial: true` |
| Partner orgs | `OrganizationType.AGENCY`, `isOfficial: false` |
| Avis tab | Mock reviews keyed by seed org UUIDs (or empty state) |

## API — Prisma

Add to `Organization` (all optional / defaulted except where noted):

```prisma
shortName            String?
tagline              String?
address              String?
phone                String?
cityLabel            String?   // display city; no new geo FK this pass
logoColor            String?   // hex, e.g. "#7065F0"
isOfficial           Boolean   @default(false)
verified             Boolean   @default(false)
foundedYear          Int?
rating               Float?
reviewCount          Int       @default(0)
dealSuccessPercent   Int?      // 0–100
```

Migration + regenerate client.

**No `AgencyReview` table** this pass.

## API — Public responses

```ts
type PublicOrganization = {
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

type PublicAgent = {
  id: string; // User.id — same as PublicProperty.agent.id for hub ↔ listing match
  organizationId: string;
  name: string | null;
  phone: string | null;
};
```

**Endpoints** (no auth):

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/organizations` | Public marketplace orgs: `(type = AGENCY) OR (isOfficial = true)`. Order: `isOfficial DESC`, then `name ASC`. Return `{ data: PublicOrganization[] }` (same envelope style as properties if used). |
| `GET` | `/organizations/:id` | One public org as above, or 404 if not in public set. Include `agents: PublicAgent[]` — members with role `AGENT`; `id` = `user.id` (align with catalog `PublicProperty.agent`). |

Do not expose OWNER-only personal orgs in the public list.

**Properties:** no change required beyond existing `organizationId` filter.

## Seed

Add stable UUIDs to `SEED_IDS` for two partner orgs + any extra agent users/members needed.

| Org | Type | isOfficial | Properties | Agents (min) |
|-----|------|------------|------------|--------------|
| Paradis Immo (`orgParadisImmo`) | PLATFORM | true | 4 existing seed listings | ≥2 (reuse existing agent + add one if needed) |
| Agence Côte Sauvage | AGENCY | false | 0 | ≥1 |
| Habitat Pointe-Noire | AGENCY | false | 0 | ≥1 |

Fill marketing fields from current mobile mocks (`shortName`, `tagline`, `address`, `phone`, `cityLabel: Pointe-Noire`, `logoColor`, ratings, etc.). Name Paradis for display: « Agence Paradis Immo » / shortName « Paradis Immo ».

Partner agencies need seed users + `OrganizationMember` rows (role AGENT). Prefer dedicated seed phones; keep deterministic UUIDs.

## Mobile

### Adapter

- `lib/map-organization.ts` — `mapPublicOrganization` → UI `Agency`; `mapPublicAgent` → UI `Agent`
- Defaults when null: `shortName ← name`, `logoColor ← #7065F0`, `tagline ← ''`, `city ← cityLabel ?? 'Pointe-Noire'`, `rating ← 0`, `reviewCount ← 0`, `dealSuccessPercent ← 0`, `foundedYear ←` omit or current year only if UI requires a number — prefer keep field optional in types if already optional; if required, use a documented constant without inventing fake history
- Agent: `displayName ← name ?? 'Conseiller'`, `initials` from name, `role` / `specialty` / `yearsExperience` static defaults so Agent rows never blank out
- `lib/agencies.ts` (or evolve `mock-agencies` consumers): `listAgencies`, `getAgency`, `listAgentsByAgency` backed by API; keep reviews helper in `lib/mock-agency-reviews.ts` (or residual mock) keyed by **seed org UUIDs**

### Screens / consumers

| Surface | Change |
|---------|--------|
| Home agency row | `listAgencies()` from API |
| Search / filters agency chips | Same |
| `AgencyChip` / trust chip | Resolve via `getAgency(agencyId)` + property `agencyName` fallback |
| `AgentRow` | Live agent when in cache; keep property `agentName` / `agentPhone` fallbacks |
| `/agency/[id]` | Fetch org detail; Biens via `listProperties({ organizationId: id })` + `mapPublicProperty`; Agents from detail; Avis from mock reviews |

Loading / error / empty Biens (« Aucun bien pour cette agence »). Pull-to-refresh optional on hub.

### Out of scope (mobile)

- Conversion / payment / leases / maintenance API
- Mapping legacy mock ids (`ag-paradis-immo`) — deep links use API UUIDs only
- Submitting reviews

## Non-goals

- Review CRUD / ratings write path
- Redistributing seed properties across agencies
- Public listing of OWNER organizations
- Changing hub visual design (profile card, tabs Biens \| Agents \| Avis)

## Acceptance

1. Home / filters list live agencies (Paradis Officiel first + 2 seeded partners)
2. `/agency/{SEED_IDS.orgParadisImmo}` shows identity card, ≥2 agents, Biens = 4 seed listings
3. Secondary hubs: marketing + agents OK; Biens empty state (no crash)
4. Tapping agency from a catalog listing opens the matching UUID hub
5. Avis tab: mock reviews for seeded IDs, or empty state
6. No hub/chip UI removed when a marketing field is null
7. API unreachable → error UX on hub/list, no crash
8. `bun run prisma:seed` after migrate fills marketing fields + partner orgs

## Follow-ups

- Tenant leases / payments / conversion against real IDs
- Optional review model + public create
- More listings per partner agency
