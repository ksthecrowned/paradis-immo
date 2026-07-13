# Owner leases detail + create (slice 3) — design

**Date:** 2026-07-12  
**Status:** Approved  
**Related:** owner polish programme (approach 1); `2026-07-12-owner-properties-shell-polish-design.md` (slice 2); `2026-06-29-paradis-immo-dashboard-ui-routes-design.md` (`/owner/leases`, `/owner/leases/[id]`)

## Goal

Owners can create a draft lease, open a lease detail page, activate it (generating the rent schedule), and navigate from a clearer managed list — without depending on the agent UI.

## In scope

1. `GET /api/v1/leases/:id` with manage-scope authorization.
2. Harden `GET /leases/:id/schedule` with the same manage-scope check (or owner/tenant access as already implied by product — at minimum: caller must be able to operate on the lease’s property **or** be the lease tenant).
3. Owner web: create lease form, detail page (activate + schedule), list polish (Voir, CTA, empty CTA).
4. Client helpers in `apps/web/lib/owner/leases.ts`.
5. OpenAPI export for new/changed lease routes.

## Out of scope

- Owner `request-sign` / mandate approval UI (agent flow remains primary for mandated sign-off).
- Terminate / cancel lease UI.
- Advanced tenant search (name/phone lookup); tenant is identified by user id for this slice (same as agent form today).
- Unifying agent and owner create into one shared component (may copy patterns; no forced refactor).
- Property/tenant display names enrichment beyond what create pickers already provide.
- Maintenance / payments slices.

## Status lifecycle (existing)

`DRAFT` → `ACTIVE` (via activate; generates rent schedule).  
Under an **active mandate**, activate already requires an approved `LEASE_SIGN` (existing API rule). Owner UI shows activate; if the API returns an error (e.g. pending approval), surface the message — do not build request-sign in this slice.

## API

### `GET /leases/:id`

- Auth: `AppAuthGuard`.
- Load lease; authorize with `AgencyAccessService.assertCanOperateOnProperty(userId, lease.propertyId)` **or** `lease.tenantId === userId`.
- 404 if missing; 403 if neither manager nor tenant.
- Response: existing `PublicLease` shape.

### `GET /leases/:id/schedule`

- Keep path; add authorization: same as get-by-id (manager of property or tenant on the lease).
- Unchanged entry shape (`PublicRentScheduleEntry[]`).

### Existing (consumed, no behavior change intended)

- `POST /leases` — create `DRAFT`
- `GET /leases/managed`
- `PATCH /leases/:id/activate`

## Web — list (`/owner/leases`)

- Header CTA « Créer un bail » → `/owner/leases/add` (or equivalent route).
- Row action **Voir** → `/owner/leases/[id]`.
- Empty state + CTA to create.
- Keep status filters; prefer showing truncated ids until enrichment exists (optional: resolve property title via `listMyProperties` map if cheap — nice-to-have, not required).

## Web — create (`/owner/leases/add`)

- Form fields aligned with agent create / `CreateLeaseDto`: property, tenant id, start/end dates, monthly rent, deposit, currency (default `XAF`).
- **Property**: select from `listMyProperties()` (id + title), not a raw UUID field.
- **Tenant**: text input for user id (document in UI hint that the locataire must already have an account).
- On success: redirect to `/owner/leases/[id]`.
- Errors: danger banner (`ApiError.message`).

## Web — detail (`/owner/leases/[id]`)

- Load lease via `GET /leases/:id`; breadcrumb with short id or « Bail » + status badge.
- Show: property id (link to owner property detail if owned), tenant id, dates, rent, deposit, status.
- If `DRAFT`: **Activer** button → `PATCH …/activate`, then reload lease + schedule.
- If `ACTIVE` (or after activate): load and show rent schedule table (`dueDate`, `amount`, `currency`, status if present).
- Loading / error banners consistent with properties polish.

## Success criteria

- Owner can create a draft lease from the dashboard without using the agent screen.
- Owner can open a lease by id and see its fields.
- Owner can activate a draft (when API allows) and see generated schedule rows.
- Unauthorized callers cannot read another owner’s lease or schedule.
- OpenAPI includes `GET /leases/{id}`.

## Follow-on slices

4. Maintenance detail  
5. Payments / receipts  
