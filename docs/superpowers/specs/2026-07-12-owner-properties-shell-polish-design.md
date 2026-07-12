# Owner properties / shell polish (slice 2) — design

**Date:** 2026-07-12  
**Status:** Approved  
**Related:** `2026-07-12-owner-dashboard-kpis-design.md` (slice 1); `2026-06-29-paradis-immo-dashboard-ui-routes-design.md` §6.2–6.3; owner polish programme (approach 1)

## Goal

Make the owner properties list/detail trustworthy for day-to-day listing management, and remove dashboard chrome that pretends to work. Owners can publish drafts, pause active listings, and act from the list without hunting through a half-finished shell.

## In scope

1. Property status transitions: **publish** and **pause** (API + web), alongside existing archive.
2. Properties list polish: photo thumb, row actions, empty state.
3. Property detail polish: status-aware header actions, titled breadcrumb, consistent loading/error chrome.
4. Shared dashboard shell cleanup: dead search, fake notification badge, decorative nav badges.

## Out of scope

- Leases / maintenance / payments / receipts (later slices).
- Multi-section create form redesign; media delete / reorder / cover picker.
- Live notification feed or real global search.
- Agent “create property for owner” flow.
- Live charts (remain demo-labeled from slice 1).

## Status lifecycle

`PropertyStatus`: `DRAFT` | `ACTIVE` | `PAUSED` | `ARCHIVED`

| Action | From | To | Endpoint |
|--------|------|----|----------|
| Publish | `DRAFT`, `PAUSED` | `ACTIVE` | `POST /api/v1/properties/:id/publish` |
| Pause | `ACTIVE` | `PAUSED` | `POST /api/v1/properties/:id/pause` |
| Archive | any non-`ARCHIVED` (existing) | `ARCHIVED` | `POST /api/v1/properties/:id/archive` |

Rules:

- Same authorization as archive: property owner (existing `assertCanManage` / owner checks — do not invent a new access path).
- Invalid transitions → `400` with a stable `code` (e.g. `INVALID_STATUS_TRANSITION`) and a French-friendly `message` for the web.
- Publishing does **not** change `listingStatus`; marketplace listing availability stays independent.
- Archived properties are not republishable in this slice (no un-archive). Owner creates a new listing if needed later.

OpenAPI export after the new routes.

## Web — list (`/owner/properties`)

- Add a **photo** column: first media by lowest `position` (from `PublicProperty.media` when present); otherwise a neutral placeholder.
- Row actions:
  - **Voir** / title link → detail
  - **Éditer** → detail (same destination; keep wording aligned with design §6.2)
  - **Publier** when status is `DRAFT` or `PAUSED` (confirm optional; prefer one-click with toast/banner on error)
  - **Archiver** with confirm (reuse existing archive API)
- Empty state: short copy + CTA « Ajouter un bien » → `/owner/properties/add`.
- Keep existing client filters (mode, status) and header CTA.

## Web — detail (`/owner/properties/[id]`)

- Page header shows property **title** + status badge.
- Actions by status:
  - `DRAFT` / `PAUSED` → Publier
  - `ACTIVE` → Mettre en pause
  - Non-archived → Archiver (confirm)
- Breadcrumbs: replace raw `[id]` segment with the property title once loaded (or a short truncated title).
- Loading / error: use the same danger banner pattern as the list; avoid silent blank screens.
- Keep existing inline edit + media uploader + visit-slots link; no form redesign.

## Web — shell (shared dashboard)

Applies to owner (and other roles using the same chrome — intentional, avoid fake chrome everywhere):

- **Remove** the non-functional topbar search input (or hide entirely until wired).
- **Remove** the hardcoded notification badge `5`; either keep a plain bell with no badge or hide the control until notifications exist.
- **Remove** decorative `NAV_BADGES` counts in the sidebar.

No new notification or search features in this slice.

## Success criteria

- Owner can take a seeded/created `DRAFT` property to `ACTIVE` from web and see it reflected in list + detail.
- Owner can pause an `ACTIVE` property and republish it.
- List shows a thumb (or placeholder) and status actions without leaving the table for publish/archive.
- Topbar/sidebar no longer show fake search results affordance or fake notification/nav counts.
- Specs/tests cover publish/pause happy path + invalid transition; OpenAPI includes the new paths.

## Follow-on slices

3. Leases detail + create  
4. Maintenance detail  
5. Payments / receipts  
