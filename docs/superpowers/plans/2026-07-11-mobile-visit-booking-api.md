# Mobile Visit Booking API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire visit booking and paid-visit cash payment on mobile to live Nest endpoints, with seed support for FREE + PAID demo paths — without removing visit/payment UI chrome.

**Architecture:** Seed Villa as PAID with slots; keep Centre-ville FREE with slots. Mobile maps `visitType`/`visitPrice`, groups API slots by day, `bookVisit` then either SuccessScreen or `initiatePayment(CASH)` → `/payment/:id` with query context.

**Tech Stack:** Nest seed, Expo Router, existing `lib/visits.ts` / `lib/payments.ts` / `lib/catalog.ts`, Bun tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-mobile-visit-booking-api-design.md`
- French copy; never remove day chips / slots / CTA / SuccessScreen
- Initiate payment **before** navigating to payment screen
- Cash only on payment screen this pass; MM UI disabled or hint only
- Short-stay / sale-inquiry / Activity Visites out of scope

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/seed.ts` | PAID on sale + slots on both FREE and PAID props |
| `apps/api/src/common/constants/seed-ids.ts` | Extra visit slot UUIDs if duplicating |
| `apps/mobile/types/property.ts` | `visitEnabled` / `visitType` / `visitPrice` |
| `apps/mobile/lib/map-property.ts` + test | Map visit fields |
| `apps/mobile/lib/visit-ui.ts` + test | Group slots by day for UI |
| `apps/mobile/app/property/[id]/visit.tsx` | Live slots + book + paid initiate |
| `apps/mobile/app/payment/[id].tsx` | Visit payment from query + success copy |

---

### Task 1: Seed FREE + PAID visit paths

**Files:** `apps/api/prisma/seed.ts`, optionally `seed-ids.ts`

- Keep `propRentLong`: `visitType=FREE`, existing 10 slots
- Set `propSale`: `visitType=PAID`, `visitPrice=5000`, `visitEnabled=true`
- Add 4–6 new slot UUIDs in `SEED_IDS.visitSlotsSale` (or extend array) assigned to `propSale` (same weekday 10:00/14:00 pattern)

- [ ] **Step 1:** Generate UUIDs and add to `SEED_IDS`

- [ ] **Step 2:** Patch sale property upsert + create sale slots loop

- [ ] **Step 3:** `cd apps/api && bun run prisma:seed`

- [ ] **Step 4:** Commit `feat(api): seed paid visit property with slots`

---

### Task 2: mapPublicProperty visit fields

**Files:** `types/property.ts`, `map-property.ts`, `map-property.test.ts`

```ts
visitEnabled?: boolean;
visitType?: 'FREE' | 'PAID' | null;
visitPrice?: number | null;
```

Map from `PublicProperty`; defaults `visitEnabled: false`, `visitType: null`, `visitPrice: null`.

- [ ] **Step 1:** Failing test asserting PAID mapping

- [ ] **Step 2:** Implement

- [ ] **Step 3:** `bun test apps/mobile/lib/map-property.test.ts` — pass

- [ ] **Step 4:** Commit `feat(mobile): map visitType and visitPrice on Property`

---

### Task 3: visit-ui groupSlotsByDay

**Files:** Create `apps/mobile/lib/visit-ui.ts`, `visit-ui.test.ts`

```ts
export type VisitDay = { key: string; label: string };
export type VisitSlotRow = {
  id: string;
  dayKey: string;
  startLabel: string;
  endLabel: string;
  paid: boolean;
  priceLabel?: string;
};
export function groupVisitSlotsByDay(
  slots: PublicVisitSlot[],
  property: Pick<Property, 'visitType' | 'visitPrice'>,
): { days: VisitDay[]; slotsByDay: (dayKey: string) => VisitSlotRow[] }
```

- Filter `status === 'AVAILABLE'`
- Day key = `YYYY-MM-DD` local; label e.g. `lun. 14 juil.` via `toLocaleDateString('fr-FR', …)`
- Time labels `HH:mm`
- `paid = property.visitType === 'PAID'`; `priceLabel` from visitPrice FCFA

- [ ] **Step 1:** Write tests

- [ ] **Step 2:** Implement

- [ ] **Step 3:** Commit `feat(mobile): group visit slots by day for UI`

---

### Task 4: Wire visit.tsx

**Files:** `apps/mobile/app/property/[id]/visit.tsx`

- Fetch slots on focus/ready with `listVisitSlots(propertyId)`
- Replace mock days/slots with `groupVisitSlotsByDay`
- Confirm: `bookVisit` → FREE setDone; PAID `initiatePayment` then navigate  
  `/payment/${payment.id}?propertyId=&visitBookingId=&amount=`
- Use `useFeedback` / `getErrorMessage` on failure
- Empty / loading states inside existing layout

- [ ] **Step 1:** Implement wiring

- [ ] **Step 2:** Manual smoke if API up

- [ ] **Step 3:** Commit `feat(mobile): wire visit screen to visit-slots API`

---

### Task 5: Wire payment/[id].tsx for visit cash

**Files:** `apps/mobile/app/payment/[id].tsx`

- Read `id`, `propertyId`, `visitBookingId`, `amount` from params
- Load property via `useCatalogProperty(propertyId)`
- Default method cash; MM disabled with hint « Bientôt disponible » or only show cash
- Confirm → SuccessScreen pending validation (no second initiate)
- Keep layout; if missing propertyId show error + back

- [ ] **Step 1:** Implement

- [ ] **Step 2:** Commit `feat(mobile): wire visit cash payment confirmation screen`

---

### Task 6: Acceptance

1. FREE Centre-ville: book slot → success  
2. PAID Villa: book → payment → pending validation copy  
3. Re-book same FREE slot → error  
4. UI chrome intact  

---

## Spec coverage

| Spec | Task |
|------|------|
| Seed FREE + PAID | 1 |
| Property visit fields | 2 |
| groupVisitSlotsByDay | 3 |
| visit.tsx | 4 |
| payment visit path | 5 |
| Acceptance | 6 |
