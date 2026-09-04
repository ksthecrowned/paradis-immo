# Mobile tenant API wiring (lot B) — Implementation Plan

> **For agentic workers:** Inline execution preferred for this lot.

**Goal:** Wire mobile leases list, maintenance create, profile documents, and activity to existing APIs; remove related mocks.

**Architecture:** New `lib/activity.ts` aggregates visits/bookings/sales/payments/rents; `lib/maintenance.ts` posts tickets; screens load via `useFocusEffect`.

**Tech Stack:** Expo Router, existing `apiFetch` clients, bun:test for mappers.

## Global Constraints

- No new mocks for these surfaces.
- Keep existing UI chrome.
- Out of scope: gallery, short-stay quote, Mobile Money provider.

---

### Task 1: Activity lib + screens
Done in session: `lib/activity.ts`, `activity.test.ts`, `app/activity.tsx`, ProspectPipelineList imports.

### Task 2: Leases list + maintenance
Done: `app/leases/index.tsx`, `maintenance/new.tsx`, `lib/maintenance.ts`, TenantLeaseSwitcher.

### Task 3: Documents + cleanup
Done: `app/profile/documents.tsx`; deleted `mock-activity`, `mock-leases`, `mock-documents` (+ tests).
