# Mobile Conversion + Activity UI — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** UI-first (mocks allowed; API gaps intentionally ignored)

## Goal

Complete the **tenant/buyer transactional UI** missing from the recent visual redesign: conversion tunnel (visit → short-stay book → sale inquiry → payment) then a full **Activity** hub with five segments — so the mobile app’s UI covers discovery **and** post-intent journeys, with real OTP auth gates.

Success = a user can, in the UI (mock data): authenticate, book a visit, reserve a short stay, submit a sale inquiry, complete a payment screen, and review Visites / Réservations / Achats / Paiements / Loyers in Activité — visually consistent with the current property detail language (`#7065F0`, floating CTAs, French copy).

## Non-goals

- Wiring real Nest API / webhooks / PDF receipts
- Owner, agent, or admin mobile surfaces
- Closing schema gaps (neighborhood POIs, 360, yearBuilt, etc.)
- i18n framework / dark mode
- Redesigning home, discover, search, or immersive map variants

## Decisions (brainstorming)

| Topic | Choice |
|-------|--------|
| Priority order | Conversion tunnel first, then Activity |
| Conversion flows | Visit + short-stay booking + payment + sale inquiry |
| Activity segments | Visites · Réservations · Achats · Paiements · Loyers |
| Data | UI mocks; ignore API mismatches for this pass |
| Auth | Real OTP gate (`ensureAuthenticated`) before protected screens |
| Navigation pattern | Linear dedicated screens (not wizard / not bottom-sheet-only) |

## Architecture & routes

```
property/[id]/visit          → pick visit slot
property/[id]/book           → short-stay dates
property/[id]/sale-inquiry   → sale interest form
payment/[id]                 → pay visit or stay
(tabs)/activity              → 5-segment hub (auth required)
```

### CTA mapping from property detail

| Property mode | Primary CTA | Route |
|---------------|-------------|-------|
| `RENT_SHORT` | Réserver | `/property/[id]/book` |
| `SALE` / `RENT_LONG` | Réserver une visite | `/property/[id]/visit` |
| `SALE` (secondary) | Demande d’achat / Faire une offre | `/property/[id]/sale-inquiry` |

After confirm:

- Paid visit or short stay → `payment/[id]`
- Free visit → success screen only
- Sale inquiry → success screen only (no payment)

### Auth

- Gate with existing OTP login before: visit, book, sale-inquiry, payment, activity tab.
- Return to the intended route after successful auth when feasible (`returnTo`).

## Screen UI

### Shared chrome

- Back `CircleIconButton` + screen title
- `PropertySummaryCard`: thumb, title, location, price label
- Floating full-width primary CTA (same visual language as property detail)
- French copy; touch targets ≥ 44pt; `accessibilityLabel` on icon-only controls

### Visit (`property/[id]/visit`)

- Horizontal day chips
- Slot list: time range, duration, free/paid badge
- Empty state if no slots
- Confirm → payment (if paid) or success « Visite réservée »

### Book (`property/[id]/book`)

- Start / end date pickers (simple calendar or dual date fields)
- Recap: nights count + total (mock)
- Confirm → `payment/[id]`

### Sale inquiry (`property/[id]/sale-inquiry`)

- Message (required)
- Optional indicative budget
- Contact prefilled from session user when available
- Submit → success « Demande envoyée »

### Payment (`payment/[id]`)

- Amount + purpose (visite / séjour)
- Method choice: Mobile Money | Espèces (agent)
- Mobile Money: phone field + Payer
- Cash: short instructions + acknowledge CTA
- Outcome: success or failure UI; CTA to Activité
- For this UI pass: prefer deterministic success (no random failure required)

### Activity (`(tabs)/activity`)

- Title « Mon activité »
- Horizontally scrollable segments: Visites · Réservations · Achats · Paiements · Loyers
- Per-segment list + contextual empty state + pull-to-refresh (reload mocks)
- List card: status badge, property title, location, date/amount/due line
- Tap: open property detail when relevant; payment/rent may open a light recap or receipt stub
- Loyers: month · amount · status; « Voir le reçu » when paid
- Paiements: method · amount · date; receipt link when available

## Components

| Component | Role |
|-----------|------|
| `PropertySummaryCard` | Shared property strip on tunnel screens |
| `StatusBadge` | success / warning / danger / neutral |
| `SegmentTabs` | Activity segment control |
| `SuccessScreen` | Post-submit full-screen confirmation |
| Existing | `CircleIconButton`, theme tokens, floating CTA styles |

## Data (mock layer)

- `lib/mock-activity.ts` (and small visit/book helpers as needed)
- Shapes should **resemble** existing mobile libs (`visits`, `bookings`, `payments`, `leases`, `sales`) so a later API pass is a swap, not a UI rewrite
- Property summary reads from current property mocks / `getPropertyById`

## Error & loading states

- Loading: disable CTA + spinner on submit
- Empty: per-screen empty copy + CTA (e.g. back to property or search)
- Payment failure: dedicated failure state with retry (optional in UI pass; success path is enough for MVP UI review)

## Out of scope reminders

- Real `apiFetch` for these flows
- Mobile Money provider integration
- Server-generated receipts
- Extending Prisma for amenities / neighborhood / 360

## Acceptance checklist (UI pass)

- [ ] Property CTA routes by mode to visit / book / sale-inquiry
- [ ] OTP required before those screens and before Activity
- [ ] Visit: days + slots + confirm (+ payment if marked paid in mock)
- [ ] Book: dates + recap + payment
- [ ] Sale inquiry: form + success
- [ ] Payment: MM + cash UI + success → Activity
- [ ] Activity: five segments with cards + empty states
- [ ] Visual consistency with current detail (primary `#7065F0`, FR, floating CTA)
- [ ] No requirement to hit live API for demo of these screens

## References

- Prior mobile launch spec: `docs/superpowers/specs/2026-07-10-mobile-ui-prod-ready-design.md`
- Current detail UI: `apps/mobile/app/property/[id]/index.tsx`
- Existing libs (future wire): `apps/mobile/lib/{visits,bookings,payments,leases,sales,auth-guard}.ts`
