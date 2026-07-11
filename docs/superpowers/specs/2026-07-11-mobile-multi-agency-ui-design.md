# Mobile Multi-Agency UI — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** UI-first (mocks allowed; API gaps intentionally ignored)

## Goal

Make the tenant/buyer mobile app reflect Paradis Immo as a **multi-agency marketplace**: listings and conversion flows show the managing **agency** and referring **agent**, users can discover agencies from Home and Search, and each agency has a public hub with properties and agents — without leaving the current visual language (`#7065F0`, French copy, floating CTAs).

Success = a user can browse by agency, open an agency hub (Biens | Agents), see agency/agent on cards and property detail, and complete visit / cash payment copy that names the right agency (± agent), all on mocks.

## Non-goals

- Nest API / Prisma wiring for organizations
- Dedicated `/agent/[id]` profile screens
- Per-agency brand themes / custom colors beyond a simple logo tint
- Owner, agent, or admin mobile surfaces
- Changing tab IA or redesigning onboarding / auth chrome

## Decisions (brainstorming)

| Topic | Choice |
|-------|--------|
| Surfaces | A+B+C: cards/detail + conversion + discovery |
| Brand posture | Paradis Immo = platform; agencies are distinct actors on listings |
| Agent depth | Agency + referring agent on detail/conversion; no `/agent/[id]` |
| Discovery | Home agency row **and** Search/Filters multi-select |
| Architecture | Lightweight attribution layer **plus** public `/agency/[id]` hub |
| Data | UI mocks; shapes resemble future org/member APIs |

## Domain (mock)

```ts
type Agency = {
  id: string;
  name: string;
  shortName: string;
  city: string; // e.g. Pointe-Noire
  logoColor: string; // tint for initial avatar
};

type Agent = {
  id: string;
  agencyId: string;
  displayName: string;
  initials: string;
};

// on Property
agencyId: string;
agentId: string;
```

**Catalog minimum:** ≥ 3 agencies in Pointe-Noire, ≥ 2 agents per agency, every `MOCK_PROPERTIES` entry has `agencyId` + `agentId`.

**Helpers** (`lib/mock-agencies.ts` + property helpers):

- `listAgencies()`, `getAgency(id)`, `listAgentsByAgency(agencyId)`
- `getAgent(id)`, `listPropertiesByAgency(agencyId)`, `listPropertiesByAgent(agentId)`

## Components

| Component | Role |
|-----------|------|
| `AgencyChip` | Compact logo/initial + name; tap → `/agency/[id]` |
| `AgentRow` | Avatar initials + « [Nom] · [Agence] »; optional chevron / « Voir l’agence » |
| Existing | `PropertyCard`, `SegmentTabs`, `PropertySummaryCard`, theme tokens |

## Routes & navigation

| Route | Auth | Purpose |
|-------|------|---------|
| `agency/[id]` | No (public) | Agency hub: header + Biens \| Agents |
| Existing property / search / home / conversion | Unchanged auth rules | Consume attribution UI |

Register `agency/[id]` in `app/_layout.tsx` (`headerShown: false`, `slide_from_right`).

### Agency hub (`agency/[id]`)

- Header: initial/logo tint, agency name, city, property count
- `SegmentTabs`: **Biens** | **Agents**
- **Biens:** `FlatList` of `PropertyCard` for that agency; empty state if none
- **Agents:** list of `AgentRow`; tap agent **filters Biens on the same screen** (local state `selectedAgentId`), does **not** navigate to `/agent/[id]`
- Clear agent filter control when a filter is active
- Missing agency id → empty « Agence introuvable » + back

### Entry points to hub

- Home horizontal « Agences » row
- `AgencyChip` on property cards
- Property detail « Voir l’agence » / chip
- (Optional) Search result chips remain tappable to hub

## Surfaces

### Home

- Horizontal scroll row « Agences » (chips) below category row → `/agency/[id]`
- Each `PropertyCard` shows `AgencyChip` (does not steal card press; chip has its own hit target)

### Search / Filters

- Extend `SearchFilters` with `agencyIds: string[]`
- Filters screen: multi-select agency section
- `filterProperties` / `countActiveFilters` / params serialization include agencies
- Empty results reuse existing search empty UI

### Property detail

- Below price (or near title meta): `AgentRow` with agency name
- Explicit control « Voir l’agence » → hub
- Primary conversion CTAs unchanged (visit / book / sale actions sheet)

### Conversion

- **Visit:** recap line « Visite avec [Agent] · [Agence] »
- **Payment (cash):** « Remettre le paiement à un agent de [Agence] » (+ agent name when session has it)
- **Book / sale-inquiry:** attribution under or inside summary strip (agency chip and/or agent line)
- Mobile Money copy stays platform-level; no agency required in MM instructions

### Activity

- Optional light touch: secondary meta may include agency short name; no Activity redesign required for this pass

## Visual & a11y

- French copy only
- Brand primary `#7065F0`; agency `logoColor` only for chip/avatar tint
- Touch targets ≥ 44pt; `accessibilityLabel` on icon-only and chip controls
- Chip tap must not trigger parent card navigation (stop propagation / nested pressables)

## Acceptance checklist

- [ ] Home agency row opens hub with Biens | Agents
- [ ] Card / detail chip or « Voir l’agence » opens hub
- [ ] Search filters multi-select agencies and filters results
- [ ] Detail shows AgentRow (agent · agency)
- [ ] Visit + cash payment copy name agency (± agent)
- [ ] Hub agent tap filters that agency’s properties in-place (no `/agent/[id]`)
- [ ] Missing agency → empty state
- [ ] FR + tokens + UI-first mocks only

## Out of scope (explicit)

- API organization endpoints
- `/agent/[id]`
- Per-agency theming of the whole app chrome
- Owner/agent mobile apps
