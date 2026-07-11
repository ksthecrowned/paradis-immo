# Mobile Visit Booking API Integration — Design Spec

**Date:** 2026-07-11  
**Status:** Approved in brainstorming  
**Scope:** Wire mobile visit booking (`/property/[id]/visit`) to live visit-slots + `POST /visits`, and paid-visit cash payment (`/payment/[id]`) via `POST /payments`. Short-stay book, sale inquiry, and Activity Visites stay out of scope.

## Goal

Replace `mock-conversion` visit slots / confirm / payment-session for the **visit** path with the Nest API, keeping the existing French UI (day chips, slot list, SuccessScreen, payment layout). Free visits confirm immediately; paid visits create a PENDING booking + CASH payment awaiting agent validation.

## Constraints

- French copy; brand / layout unchanged (`#7065F0`)
- **Never remove** day selector, slot list, CTA, SuccessScreen, or payment method chrome — disable or empty-state inside the same blocks
- Auth OTP (`ensureAuthenticated`) already required — keep it
- Catalog property IDs are real UUIDs; seed has visit slots
- Agent payment validation and `PATCH /visits/:id/confirm` stay on web/API (not mobile)

## Decisions

| Topic | Choice |
|-------|--------|
| Slice | Visits only (A) |
| Paid visits | Cash API initiate + pending-validation UX (option 2) |
| Architecture | Adapter slots + book on visit screen; real payment id before `/payment/[id]` (approach 1) |
| Payment initiate timing | **Before** navigating to payment screen (visit confirm handler) |
| Mobile Money on payment screen | UI may remain; only **cash** path wired this pass (MM disabled or no-op with French hint) |
| Activity Visites tab | Still mock |

## API (existing — no contract change required)

| Step | Endpoint | Notes |
|------|----------|--------|
| List slots | `GET /properties/:id/visit-slots` | Public; filter client-side to `status === 'AVAILABLE'` |
| Book | `POST /visits` `{ propertyId, slotId }` | Auth; FREE → `CONFIRMED` + slot BOOKED; PAID → `PENDING`, slot stays AVAILABLE |
| Pay | `POST /payments` | Auth; CASH → `PENDING_VALIDATION`; amount = property `visitPrice`, currency `XAF`, unique `idempotencyKey` |
| Validate / confirm | Agent web | Out of scope for mobile |

Allocation `VISIT_BOOKING` is attached at **agent validation**, not at initiate (matches e2e `paid-visit`).

## Seed

- Keep (or ensure) **FREE** visits + AVAILABLE slots on at least one demo property usable for the free happy path (e.g. Centre-ville `propRentLong` stays `visitType=FREE` with existing slots).
- Set **Villa vente** (`propSale`) to `visitType=PAID`, `visitPrice=5000`, `visitEnabled=true`, and ensure AVAILABLE slots (move/duplicate seed slots onto sale if needed so PAID path is testable while FREE still works).
- Both properties remain ACTIVE marketplace listings as today.

## Mobile

### Property mapping

Extend UI `Property` + `mapPublicProperty` with:

```ts
visitEnabled: boolean;
visitType: 'FREE' | 'PAID' | null;
visitPrice: number | null; // XAF
```

Defaults: `visitEnabled: false`, `visitType: null`, `visitPrice: null` — visit CTA already gated by product rules; do not remove CTA chrome when fields missing (show empty slots / disabled confirm instead).

### Visit UI helpers

`groupVisitSlotsByDay(slots, property)` → day keys/labels (FR) + slot rows with `startLabel` / `endLabel` / `paid` / `priceLabel` derived from **property** visit type/price (not per-slot API fields).

### Screens

**`app/property/[id]/visit.tsx`**
- Load property via catalog hook; fetch `listVisitSlots`
- Confirm → `bookVisit`
- FREE → SuccessScreen
- PAID → `initiatePayment({ amount: visitPrice, currency: 'XAF', method: 'CASH', idempotencyKey })` then `router.push(/payment/{id}?propertyId=&visitBookingId=)`
- Errors: slot conflict / network via existing feedback; loading / empty « Aucun créneau »

**`app/payment/[id].tsx`** (visit path)
- No `GET /payments/:id` today — use route `id` + query (`propertyId`, `visitBookingId`, `amount`) populated from the initiate response; optionally refresh status via `listMyPayments` and find by id
- Property via catalog `propertyId` query
- Cash confirm → SuccessScreen: en attente de validation par l’agence
- Do **not** call initiate again on this screen
- Drop `getMockPaymentSession` / `getPropertyById` mock for this path

### Non-goals

- Short-stay `/book`, sale-inquiry, Activity wiring
- Mobile Money provider initiate
- Agent validate payment / confirm visit on mobile
- Changing visit hub visual design

## Acceptance

1. FREE property with slots → book → SuccessScreen confirmed  
2. PAID property with slots → PENDING booking → CASH payment → `PENDING_VALIDATION` + validation-agency copy  
3. Double-book / unavailable slot → clear error, no crash  
4. Day chips / slots / CTA / SuccessScreen retained  
5. Unauthenticated user redirected to OTP then back to visit  
6. Seed after migrate/seed supports both FREE and PAID demo paths  

## Follow-ups

- Wire short-stay book + payment allocation BOOKING  
- Sale inquiry API on mobile  
- Activity Visites from `GET /visits/my`  
- Optional: initiate payment with server-side VISIT_BOOKING allocation hint
