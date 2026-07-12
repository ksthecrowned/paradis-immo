# Owner dashboard KPIs (slice 1) — design

**Date:** 2026-07-12  
**Status:** Approved for planning  
**Related:** `2026-06-29-paradis-immo-dashboard-ui-routes-design.md` §6.1; owner polish programme (approach 1 — one slice at a time)

## Context

The owner home at `/owner/dashboard` already uses the Darkone shell (`StatCard`, charts, tables). Two KPI cards fall back to hardcoded values (`12` / `8`). Pending payments are loaded from `GET /payments/my` (payer scope) instead of managed owner payments. Visit requests are already live from `GET /visits/managed`. Charts remain demo data (acceptable for earlier MVP shell work).

This slice makes the four KPI counters and the two recent tables trustworthy. Later slices cover properties polish, leases, maintenance, and payments/receipts.

## Goals

- Expose real owner-scoped KPI counts via a dedicated stats endpoint.
- Wire `/owner/dashboard` to that endpoint and to the correct payment list endpoint.
- Keep the existing Darkone layout; annotate demo charts so they are not mistaken for live data.
- Deliver a testable API + web page without building revenue time-series or agent stats.

## Non-goals

- Real revenue / mode / map chart data or historical sparklines.
- Agent or admin dashboard changes.
- Property / lease / maintenance / receipt detail UX (later slices).
- New mobile screens.

## Approach

**Hybrid (option C):**

| Concern | Source |
|---------|--------|
| Four KPI counters | `GET /api/v1/owner/stats` (server `count()` queries) |
| Recent payments table | `GET /api/v1/payments/managed` (web takes latest 5) |
| Recent visits table | `GET /api/v1/visits/managed` (web takes latest 5) |

Client-side aggregation of full lists for KPIs is rejected: heavier payloads and easy drift from list filters. A pure stats-only page without recent tables is rejected: §6.1 already specifies those tables.

## API: `GET /api/v1/owner/stats`

### Auth and scope

- Requires JWT (`JwtAuthGuard`).
- Caller must have owner portfolio access using the **same org/property scope** as `GET /properties/mine`, `GET /leases/managed`, `GET /payments/managed`, and `GET /visits/managed`.
- Unauthorized → `401`. Authenticated but out of scope for owner stats → `403` (same posture as other managed owner routes).

### Response body

```json
{
  "activeProperties": 0,
  "activeLeases": 0,
  "pendingPayments": 0,
  "pendingVisitRequests": 0
}
```

All fields are non-negative integers.

### Counter rules

| Field | UI label | Definition |
|-------|----------|------------|
| `activeProperties` | Biens actifs | Properties in owner scope with `Property.status = ACTIVE` |
| `activeLeases` | Baux actifs | Leases in managed scope with `Lease.status = ACTIVE` |
| `pendingPayments` | Paiements en attente | Payments in managed scope with `PaymentStatus ∈ { INITIATED, PENDING_VALIDATION }` |
| `pendingVisitRequests` | Demandes de visite | Visit bookings in managed scope with `VisitBooking.status = PENDING` |

Explicit exclusions for `pendingPayments`: do **not** count `FAILED`, `DISPUTED`, or `VALIDATED`.

Implementation should use parallel Prisma `count()` calls with the same where-clauses / org membership helpers as the corresponding list endpoints—not load full lists then count in memory.

### Placement

- Nest module/service dedicated to owner stats (e.g. `OwnerStatsService`), patterned after `AdminService.getStats`.
- Route under `/owner/stats` (controller naming may follow existing API conventions for role namespaces).

## Web: `/owner/dashboard`

### Data loading

On session ready, fetch in parallel:

1. `GET /owner/stats`
2. `GET /payments/managed`
3. `GET /visits/managed`

Remove hardcoded property/lease fallbacks. Stop calling `/payments/my` for this page.

### UI behavior

- Four `StatCard`s bind to the four stats fields; existing deep-links (properties, leases, payments, visits) stay.
- Tables show up to five rows each, newest first, using existing `DataTable` / `StatusBadge` patterns and empty-state copy.
- Loading: keep the current skeleton (four cards + chart placeholders).
- If stats fail: show a danger banner; still render payment/visit tables when those calls succeed.
- If a list call fails: treat that list as empty (or show a localized inline error if already patterned elsewhere—prefer empty + banner only when stats fail, matching current visit/payment soft-fail style for lists).

### Charts (demo)

Keep `RevenueChart`, `PropertyModeChart`, and `SessionsMapCard` as demo data for this slice. Add a discreet label such as **« Aperçu (données démo) »** on those blocks so owners do not treat them as live metrics. No chart API work in this slice.

### Shell / Darkone

No shell redesign. Apply Darkone tokens already in use; no new visual system.

## Testing

**API**

- Owner with empty portfolio → all four counts `0`.
- Owner with fixtures → counts match the filter definitions above.
- Non-owner JWT (e.g. tenant without managed scope) → `403`.

**Web**

- Manual smoke: login as seeded owner (`owner@paradisimmo.cg`), open `/owner/dashboard`, confirm cards match API and tables use managed payments/visits.
- Automated UI tests optional for this slice.

## Success criteria

- No hardcoded KPI numbers on the owner dashboard.
- Payments table reflects managed payments, not the caller’s personal payer history.
- Stats endpoint documented in OpenAPI if the project exports it as part of normal API changes.
- Demo charts visibly labeled as demo.

## Follow-on slices (out of scope here)

1. ~~Dashboard KPIs~~ (this doc)
2. Properties / shell polish
3. Leases detail + create
4. Maintenance detail
5. Payments / receipts
