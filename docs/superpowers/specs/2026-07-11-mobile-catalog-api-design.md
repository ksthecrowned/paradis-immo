# Mobile Catalog API Integration — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** Wire mobile catalog (Home / Search / Discover / property detail) to the Nest API, enriching the API so UI fields are real where possible. **No visual element may be removed** when data is missing — use API enrichment or static/default fallbacks inside the same UI blocks.

## Goal

Replace `mock-properties` as the source of truth for listing discovery and detail with live `GET /properties` (+ media), after extending Prisma/`PublicProperty` with the rich fields the mobile UI already shows (features, availability, extras, organization/agent).

## Constraints

- French copy only; brand / layout unchanged
- **Never remove a UI block** because the API lacks a field — either add the field on the API or keep a static/default value so the block still renders meaningfully (empty amenities list is OK; deleting the amenities section is not if it existed)
- Seed + R2 photos already available (`SEED_IDS`, `seed/houses/houseN.jpg`)
- Auth OTP unchanged; conversion / activity / leases out of scope

## Decisions

| Topic | Choice |
|-------|--------|
| First integration slice | Catalog only |
| Gap policy | Maximize API (option 3) |
| Architecture | Approach A: enrich Prisma + map `PublicProperty` → UI `Property` |
| Missing agent | `null` → stable UI fallback for AgentRow (no crash, row kept) |
| Multi-agency hubs | Stay mock for this pass |
| Conversion / Activity / Leases | Later passes |

## API — Prisma

Add to `Property` (all nullable except listing availability default).

```prisma
enum ListingAvailability {
  AVAILABLE
  UNAVAILABLE
}

enum UnavailableReason {
  RENTED
  SOLD
  RESERVED
}

// on Property — ADD (do not rename relation `availability` → AvailabilityBlock[]):
features             Json?                 // string[] PropertyFeatureId
listingAvailability  ListingAvailability   @default(AVAILABLE)
unavailableReason    UnavailableReason?
floor                String?
yearBuilt            Int?
condition            String?
lotSize              Float?
parkingSpaces        Int?
orientation          String?
landTitle            String?
mapViews             Json?                 // string[] PropertyMapView
```

> Note: scalar is **`listingAvailability`**, not `availability` (that name is the AvailabilityBlock relation).

Migration + regenerate client. Seed the four demo properties with values aligned to former mobile mocks (features, listingAvailability/reasons, extras).

## API — Public responses

Extend `PublicProperty` (list + detail):

```ts
listingAvailability: 'AVAILABLE' | 'UNAVAILABLE';
unavailableReason: 'RENTED' | 'SOLD' | 'RESERVED' | null;
features: string[];
mapViews: string[];
// floor, yearBuilt, condition, lotSize, parkingSpaces, orientation, landTitle
media: Array<{ id: string; url: string; type: string; position: number }>;
organization: { id: string; name: string; type: string }; // prefer over ownerOrg in mobile adapter
agent: { id: string; name: string; phone: string | null } | null;
```

**Agent resolution:** first `OrganizationMember` with role `AGENT` on `property.organizationId`, include `user.name` / `user.phone`. If none → `null`.

**Media:** include ordered `PropertyMedia` on list and detail (list may cap e.g. first 5 URLs; detail full list).

Keep existing filters (`status`, `mode`, `cityId`, price range, etc.). Mobile can filter `availableOnly` client-side from mapped `Property.availability` (from `listingAvailability`).

## Mobile

### Adapter

`mapPublicProperty(api: PublicProperty): Property` in e.g. `lib/map-property.ts`:

| UI field | Source |
|----------|--------|
| id, title, description, mode, lat, lng | API |
| price | format number + currency → `« N FCFA »` |
| coverImage / images | media sorted by position |
| location | `quartier.name, city.name` |
| surface | `surface != null ? \`${surface} m²\` : undefined` |
| category | map `APARTMENT→apartment`, etc. |
| features, mapViews, floor, … | API or defaults |
| availability | from `listingAvailability` |
| unavailableReason | API |
| agencyId | `organization.id` |
| agentId | `agent?.id` ?? documented fallback constant for UI components that require a string |

Defaults when null: `availability: AVAILABLE`, `features: []`, `mapViews: ['neighborhood']` if coords else `[]` / configured list — **components that render these sections stay mounted**.

### Screens

- `(tabs)/index` (Home), `search`, `discover`, `property/[id]/index` (+ gallery / neighborhood consumers that take property from parent or fetch by id)
- Loading, empty, error (Feedback / ScreenError); pull-to-refresh where lists exist
- Stop importing `MOCK_PROPERTIES` / `getPropertyById` for these catalog paths; keep mock modules for agency hubs / conversion until later

### Filters

- Existing search filters continue; `availableOnly` filters mapped `availability`
- Agency chips: match `organization.id` when selected; if mock agency ids ≠ API org ids, chips that cannot match simply yield empty list (UI retained)

## Non-goals

- Visit / book / sale-inquiry / payment API wiring
- Activity / leases / maintenance / profile documents
- Replacing `/agency/[id]` multi-agency mock hub
- Mobile media upload
- Removing Dispo border, trust chip, feature row, map entry points, AgentRow from more-actions, etc.

## Acceptance

1. Home / Search / Discover show seed listings with R2 images
2. Detail shows gallery, price, location, amenities when seeded, Indispo badge when unavailable
3. Trust / agency naming uses API organization name (Paradis Immo)
4. No previously present catalog UI chrome removed
5. API unreachable → error UX, no crash
6. `bun run prisma:seed` after migrate fills enriched fields

## Follow-ups

- Conversion tunnel against real IDs
- Activity + leases
- Full multi-agency API model matching mock hubs
