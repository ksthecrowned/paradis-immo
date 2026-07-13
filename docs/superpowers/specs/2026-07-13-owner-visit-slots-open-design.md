# Owner visit slots — open / block / unblock (slice 6) — design

**Date:** 2026-07-13  
**Status:** Approved  
**Related:** owner polish programme 2 (B+C); user chose one-off slots over template focus; `AgencyAccessService` already used in `VisitSlotsService`

## Goal

Owners can **open a one-off visit slot** for a specific date/time, see all upcoming slots for the property (all statuses), **block** and **unblock** slots — with a **very clean UI** aligned with the mobile app’s calm, sparse layout.

## Visual direction (required)

Match the **mobile product feel**, not a dense admin CRUD page:

- **One job above the fold:** “Ouvrir un créneau” (start + duration → primary CTA). No competing forms in the first viewport.
- **Sparse layout:** generous spacing, short French labels, minimal chrome. Prefer a simple list of upcoming slots over heavy multi-table dashboards.
- **Few controls:** list row actions only when relevant (Bloquer / Débloquer). Avoid pill clusters, extra filters beyond status, and nested card stacks.
- **Templates secondary:** weekly templates stay available but visually de-emphasized (collapsed section, lower on the page, or “Modèles hebdo” after the slot list) — not the hero of this page.
- **Tokens:** reuse dashboard CSS variables (`accent` / primary purple family already shared with mobile `#7065F0`, muted text, soft borders). Do not invent a new palette.
- **No calendar month grid** in this slice (list + datetime inputs are enough).

## Problem (current gaps)

1. Only `POST …/visit-slots/block` exists for manual slots — no way to create an `AVAILABLE` one-off slot.
2. No unblock (`BLOCKED` → `AVAILABLE`).
3. Owner page loads **public** `listAvailableSlots` → only `AVAILABLE`, so blocked slots disappear from the UI.
4. Page is template-first and form-heavy — not “ouvrir un créneau” as the main gesture.

## In scope

1. `POST /properties/:id/visit-slots/open`
2. `POST /visit-slots/:id/unblock`
3. `GET /properties/:id/visit-slots/managed` (auth, all statuses, upcoming)
4. Owner web: open form, managed list + block/unblock actions, block range kept but secondary
5. Client helpers; OpenAPI export
6. UI polish toward sparse / mobile-like hierarchy on this page only

## Out of scope

- Redesign of weekly template CRUD beyond demoting it visually
- Visit requests list/detail (slice 7)
- Unblock of `BOOKED` slots; cancel confirmed visits from this page
- Month calendar UI
- Payments follow-ups / dashboard charts (programme B later)
- Changing public seeker `GET …/visit-slots` behavior

## API

### Auth / scope

All mutate + managed list: `AppAuthGuard` + existing `assertCanManageProperty` (`AgencyAccessService`).

### `POST /properties/:id/visit-slots/open`

- Body: `{ startAt: ISO string, endAt: ISO string }`
- Property must exist, `visitEnabled === true` (else 400 `VISITS_DISABLED` or clear not-found messaging consistent with booking)
- `endAt > startAt` else `INVALID_SLOT_RANGE`
- Upsert on `(propertyId, startAt)`:
  - Create: `AVAILABLE`, `source: MANUAL`
  - Update: if existing status is `BOOKED` → `409` / BadRequest `SLOT_BOOKED`; else set `AVAILABLE` + `MANUAL` (re-open blocked or overwrite empty manual)
- Response: `PublicVisitSlot`

### `POST /visit-slots/:id/unblock`

- Load slot; manage-scope on `propertyId`
- If status ≠ `BLOCKED` → `400 SLOT_NOT_BLOCKED`
- Set `AVAILABLE` (keep `source`)
- Response: `PublicVisitSlot`

### `GET /properties/:id/visit-slots/managed`

- Query optional `from` / `to` (default `from = now`)
- Returns slots for property with **any** status, ordered by `startAt` asc
- Not anonymous (unlike public available list)

### Existing

- `POST …/visit-slots/block` — unchanged
- Public `GET …/visit-slots` — unchanged (AVAILABLE only for seekers)
- Templates endpoints — unchanged

## Web — `/owner/properties/[id]/visit-slots`

### Hierarchy (top → bottom)

1. Header: title + lien retour fiche bien  
2. Si `!visitEnabled` : empty state court + lien activer sur la fiche (inchangé)  
3. **Ouvrir un créneau** — un seul bloc léger : datetime début, durée (min, défaut 30), bouton primary **Ouvrir**  
4. **À venir** — liste managed (date, statut, source optionnelle) + actions Bloquer / Débloquer  
5. **Bloquer une plage** — formulaire secondaire compact (existant, allégé)  
6. **Modèles hebdomadaires** — section secondaire (liste + ajout), pas au-dessus de l’open

### List actions

| Status | Actions |
|--------|---------|
| `AVAILABLE` | Bloquer (appelle `block` sur la plage du slot, ou endpoint dédié réutilisant start/end) |
| `BLOCKED` | Débloquer |
| `BOOKED` | aucune |

### Helpers (`lib/owner/visit-slots.ts`)

- `openSlot(propertyId, { startAt, endAt })`
- `unblockSlot(slotId)`
- `listManagedSlots(propertyId, from?, to?)`
- Keep `blockSlot`, templates helpers

## Success criteria

- Owner with visits enabled opens a future one-off slot; it appears as `AVAILABLE` and is bookable via public list.
- Owner blocks then unblocks; status returns to `AVAILABLE`.
- Managed list shows `BLOCKED` and `BOOKED`, not only available.
- Stranger cannot open/unblock/list managed for another portfolio.
- Page first viewport reads as “open a slot”, not “manage templates”.
- OpenAPI includes the three new operations.

## Programme context

| Slice | Focus |
|-------|--------|
| **6 (this)** | One-off open / block / unblock + sparse UI |
| 7 | Visit requests (names, links) |
| 8 | Mandate inventory |
| 9 | Short-stay bookings polish |
| 10 | Follow-ups B (payment names, charts, agent validate) |
