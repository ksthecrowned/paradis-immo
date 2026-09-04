# Mobile tenant API wiring (lot B)

**Goal:** Replace seeker/tenant mocks for leases list, maintenance create, profile documents, and activity/prospect with existing API clients.

**Out of scope:** Property gallery/catalog mocks, short-stay quote (`mock-conversion`), Mobile Money provider, purchases/stays mock detail screens.

## Approach

Wire screens to existing `lib/leases`, `documents`, `bookings`, `visits`, `payments`, `sales`. Add `lib/activity.ts` (aggregate + map to UI rows) and `lib/maintenance.ts` (create ticket). Keep current UI shapes (`ActivityItem`, lease cards).

## Screens / modules

| Surface | Before | After |
|---------|--------|-------|
| `app/leases/index.tsx` | `mock-leases` + `mock-properties` | `listMyLeases` + schedule + `fetchCatalogProperty` |
| `app/leases/[id]/maintenance/new.tsx` | mock tickets | `POST /maintenance/tickets` with lease `propertyId` |
| `app/profile/documents.tsx` | `mock-documents` | `listMyDocuments` + open `url` |
| `app/activity.tsx` | `mock-activity` | `fetchActivity(segment)` |
| Prospect helpers | `listProspectPipeline` mock | Pure build from activity items (API-fed) |
| `TenantLeaseSwitcher` | `MockLease` | `PublicLease` + optional title/location props |

## Activity mapping

- visits ← `listMyVisits`
- bookings ← `listMyBookings`
- sales ← `listMySaleInquiries`
- payments ← `listMyPayments`
- rents ← active leases’ schedules (next open line)

Property title/location: best-effort `fetchCatalogProperty`; fallback « Bien » / « Pointe-Noire ».

## Maintenance priorities

API enum: `LOW | MEDIUM | HIGH | URGENT`. UI maps former `NORMAL` → `MEDIUM`.

## Success

No runtime imports of `mock-leases`, `mock-activity`, or `mock-documents` from app screens/components in this lot. Unit tests cover activity mappers (pure).
