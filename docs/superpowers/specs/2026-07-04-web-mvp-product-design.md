# Web MVP Product — Design Spec

**Date:** 2026-07-04  
**Status:** Approved in brainstorming (web-only, product-grade, reduced surface but full modes)

## Goal

Ship a **usable web back-office** for Paradis Immo (Congo): owners, agency agents, and platform admins can operate day-to-day for **all property modes** (`RENT_LONG`, `RENT_SHORT`, `SALE`), including **multi-image upload**. The public **landing page** shows a few live listings and drives users to **download the mobile app**; it does not replace the mobile client journey.

Success = no blocking placeholders in dashboard sidebars; real API-backed flows; errors visible; media works when R2 is configured.

## Non-goals (this MVP cut)

- Mobile app screens (Expo Tasks 28–31)
- Full public web marketplace / payment tunnel for end customers
- Advanced admin configuration (feature flags, provider keys UI)
- Pixel-perfect infinite landing iteration (landing will evolve later)
- Production Docker / full E2E suite (can follow immediately after, not in this cut)

## Actors & surfaces

| Actor | Surface | Purpose |
|-------|---------|---------|
| Owner | `/owner/*` | Publish & manage own properties (all modes), photos, visit slots, visits, leases, payments view, maintenance, mandate approvals |
| Agent | `/agent/*` | Portfolio (mandated/org), visits, cash payment validation, lease create, maintenance, sale inquiries |
| Admin | `/admin/*` | Stats, users, property moderation, minimal config (store URLs copy) |
| Anonymous | `/` | Marketing + sample ACTIVE listings + app download CTA |
| Authenticated | `/login` | OTP via NextAuth (access + refresh tokens) |

## Architecture

```
Browser
  ├── Landing (RSC/client) → GET /properties?status=ACTIVE&limit=6
  ├── NextAuth session cookie (JWT: accessToken, refreshToken)
  ├── proxy.ts → unauthenticated /owner|/agent|/admin → /login
  │              /admin/* requires PLATFORM_ADMIN
  └── apiFetch(Bearer accessToken) → Nest API /api/v1
         └── R2 presigned PUT for media bytes
```

**UI kit:** Darkone tokens (`globals.css`), `ListDataTable` / `PaginatedDataTable`, `DashboardPageHeader`, Iconify Solar.

**Auth (already shipped):** NextAuth Credentials OTP, JWT refresh in `auth.ts`, `proxy.ts`, `useRequireSession`.

## Functional requirements by role

### Owner

1. **Properties**
   - List own properties (`GET /properties/mine` — **new**).
   - Create property for any `PropertyMode` / `PropertyType` with location (quartier cascade or select), pricing, visit flags.
   - Detail + edit core fields; archive via existing API if available.
   - **Media:** multi-image upload: presign → PUT to R2 → confirm; list gallery; show primary image in lists.
   - If R2 env missing: clear error on upload, form still saves property without images.

2. **Visit slots** (when `visitEnabled`)
   - CRUD templates and list slots via existing visit-template / visit-slots endpoints.

3. **Visits** — `GET /visits/managed`, confirm/cancel.

4. **Leases** — `GET /leases/managed` (**new**), read-only list + link to schedule if useful.

5. **Payments** — list payments relevant to owner (prefer managed list if added; else document limitation and use available endpoints).

6. **Maintenance** — tickets on managed properties.

7. **Mandate** — `GET /mandates/pending-approvals`, approve/reject.

### Agent

1. **Portfolio** — properties for Paradis Immo org / mandates (filter `organizationId` or managed list).
2. **Visits** — already implemented; keep.
3. **Payments validation** — already implemented; keep.
4. **Leases** — create form (`POST /leases`); show mandate-pending state.
5. **Maintenance** — managed tickets.
6. **Sales** — `GET /sales/inquiries/managed`, `PATCH .../status` (add nav item).

### Admin

1. **Dashboard / users** — already implemented; keep.
2. **Moderation** — list properties, `PATCH /admin/properties/:id/moderate` (`ACTIVE` | `PAUSED` | `ARCHIVED`).
3. **Config** — display/edit only public store URLs via env (read-only UI is enough: show configured URLs, no secrets).

### Landing

1. Fetch up to 6 `ACTIVE` properties (title, price, mode, first image if any).
2. Card click does **not** open a full public funnel: prompt to download the app.
3. CTA buttons: `NEXT_PUBLIC_APP_STORE_URL`, `NEXT_PUBLIC_PLAY_STORE_URL` (hide button if URL empty).

## API additions

| Method | Path | Behavior |
|--------|------|----------|
| `GET` | `/properties/mine` | Auth required; properties where `ownerId = current user`; same public shape as list items |
| `GET` | `/leases/managed` | Auth required; leases on properties user owns or org-manages |
| `GET` | `/bookings/managed` | Auth required; short-stay bookings on managed properties |

Regenerate OpenAPI + web types after API changes.

Existing endpoints to consume: properties CRUD, media presign/confirm/list, visits, payments pending-validation + validate, mandates, maintenance, sales inquiries, admin stats/users/moderate, locations.

## Media upload UX

1. User creates or opens property.
2. For each file (jpeg/png/webp, max size per API DTO): `POST /properties/:id/media/presign` → `PUT` to `uploadUrl` → `POST .../confirm` with public URL + type + position.
3. Gallery shows thumbnails; optional reorder later (out of scope if API has no reorder — use position at confirm time).
4. Failures: per-file error message; do not block other files.

## Auth & authorization

- Session: NextAuth JWT with `accessToken` / `refreshToken`; refresh in JWT callback.
- `proxy.ts`: protect `/owner`, `/agent`, `/admin`; redirect to `/login?callbackUrl=`.
- Role rules:
  - `/admin/*` → `PLATFORM_ADMIN`
  - `/agent/*` → org member `AGENT` **or** `PLATFORM_ADMIN`
  - `/owner/*` → authenticated (owner org auto-created on first property)
- Role switcher in topbar when user has multiple eligible dashboard roles (`lib/active-role.ts`).

## Error handling

- `ApiError.message` shown in page banners.
- 401 after failed refresh → sign out → login.
- Empty lists: French empty states, not placeholders “à venir”.

## Delivery order (critical paths)

1. API `properties/mine` + owner property list/create/detail + media upload  
2. Owner visit slots  
3. Owner visits, leases managed, payments, maintenance, mandate  
4. Agent portfolio, leases form, maintenance, sales  
5. API `bookings/managed` + owner/agent short-stay list (if mode RENT_SHORT)  
6. Admin moderation + config + role switcher + role guards in proxy  
7. Landing live properties + app CTA  

## Test plan (manual)

| # | Flow |
|---|------|
| 1 | Owner seed: create RENT_LONG + 2 photos, see in list |
| 2 | Owner: create SALE and RENT_SHORT properties |
| 3 | Owner: visit template on visit-enabled property |
| 4 | Agent: validate cash payment (seed pending) |
| 5 | Agent: create lease; owner approves mandate if required |
| 6 | Agent: list/update sale inquiry |
| 7 | Admin: pause property; public list / landing no longer shows it if ACTIVE-only |
| 8 | Logged-out access to `/admin/users` → login |
| 9 | Landing shows ACTIVE properties; CTA opens store URL |

## Open decisions (resolved)

- Web only for this cut; mobile later.
- All modes in scope on back-office.
- Landing = teaser + app download, not full public product.
- Product-grade quality, reduced *breadth of channels* (no mobile), not reduced *honesty* of features.
