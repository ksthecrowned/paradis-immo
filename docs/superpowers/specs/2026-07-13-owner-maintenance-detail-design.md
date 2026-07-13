# Owner maintenance detail (slice 4) — design

**Date:** 2026-07-13  
**Status:** Approved  
**Related:** owner polish programme; `2026-07-12-owner-leases-detail-create-design.md` (slice 3); `2026-06-29-paradis-immo-dashboard-ui-routes-design.md` (`/owner/maintenance`, `/owner/maintenance/[id]`)

## Goal

Owners can open a maintenance ticket detail page, update status and estimated cost, assign a technician by user id, and navigate from the managed list — with API access checks aligned to property manage-scope.

## In scope

1. `GET /api/v1/maintenance/tickets/:id` with authorize: manage property **or** reporter.
2. Harden `PATCH …/tickets/:id` and `PATCH …/tickets/:id/assign` so only managers of the property may mutate (not arbitrary authenticated users).
3. Owner web detail page: status, estimated cost, assignee id, approval flag display.
4. List polish: **Voir** → detail; empty-state polish if missing.
5. Client `getMaintenanceTicket`; fix status labels to match Prisma (`DONE`, not `RESOLVED`).
6. OpenAPI export.

## Out of scope

- Mandate / `MAJOR_REPAIR` approval UI (keep existing API behavior; show `requiresOwnerApproval` badge only).
- Dedicated `/owner/maintenance/add` (create stays on list).
- Assignee picker / agent directory search (raw user id, same pattern as lease tenant).
- Agent maintenance detail page (may reuse helpers later).
- Payments / receipts (slice 5).

## Status values (Prisma)

`OPEN` | `ASSIGNED` | `IN_PROGRESS` | `DONE` | `CLOSED`

Assigning an `OPEN` ticket still auto-sets status to `ASSIGNED` (existing API rule).

## API

### `GET /maintenance/tickets/:id`

- Auth: `AppAuthGuard`.
- Load ticket; allow if `AgencyAccessService.assertCanOperateOnProperty(userId, propertyId)` **or** `reporterId === userId`.
- 404 if missing; 403 otherwise.
- Response: existing `PublicMaintenanceTicket`.

### `PATCH /maintenance/tickets/:id` and `…/assign`

- Pass `current.userId` into service.
- Require manage-scope on the ticket’s property (`assertCanOperateOnProperty`).
- Reporter-only users may **read** but not update/assign.

### Existing (consumed)

- `GET /maintenance/tickets/managed`
- `POST /maintenance/tickets`
- Update/assign body shapes unchanged.

## Web — list (`/owner/maintenance`)

- Row **Voir** → `/owner/maintenance/[id]`.
- Keep inline create form.
- Empty message remains clear; optional CTA not required (create is on-page).

## Web — detail (`/owner/maintenance/[id]`)

- Load via `getMaintenanceTicket`.
- Header: title + status badge; breadcrumb Maintenance → short id.
- Show: property link, reporter id, description, priority, `requiresOwnerApproval` if true.
- Actions:
  - Status `<select>` → `updateMaintenanceTicket({ status })`
  - Estimated cost number input + save → `updateMaintenanceTicket({ estimatedCost })`
  - Assignee id + **Assigner** → `assignMaintenanceTicket`
- Loading / error banners consistent with leases/properties polish.

## Success criteria

- Owner can open a managed ticket by id and see its fields.
- Owner can change status and estimated cost; assign a valid user id.
- Stranger cannot GET or PATCH another owner’s ticket.
- Reporter can GET their own ticket but cannot PATCH if they are not a manager.
- OpenAPI includes `GET /maintenance/tickets/{id}`.
- UI status labels use `DONE` (not `RESOLVED`).

## Follow-on

5. Payments / receipts  
