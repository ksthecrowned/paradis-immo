# Mobile Portfolio Locations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Locations mode tabs with a unified portfolio property list; tap opens rent hub (active lease) or property timeline; French long dates + relative due labels.

**Architecture:** `listPortfolioProperties()` aggregates mocks by `propertyId`. Routes `/portfolio/[propertyId]` (timeline) and `/portfolio/[propertyId]/rent` (hub). Shared `formatDateFr` / `formatDueLabel`.

**Tech Stack:** Expo Router, RN, Bun tests, existing tenant components.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-mobile-portfolio-locations-design.md`
- Conversion-only portfolio (no favorites-only)
- Badge priority: Locataire > Achat en cours > Séjour > Visite
- Date rules as in spec (aujourd’hui / demain / N jours / 1 semaine / semaines / retard)

---

### Task 1: Date helpers (TDD)

**Files:** Create `apps/mobile/lib/format-date-fr.ts` + `.test.ts`

- [x] `formatDateFr` → `15 mai 2026`
- [x] `formatDueLabel` per spec day buckets
- [x] `bun test lib/format-date-fr.test.ts`

### Task 2: Portfolio aggregation (TDD)

**Files:** Create `apps/mobile/lib/portfolio.ts` + `.test.ts`

- [x] `PortfolioRelation` + `PortfolioItem` types
- [x] `listPortfolioProperties()` from leases, stays, purchases, visits
- [x] primaryRelation priority + sort by lastAt
- [x] Tests: one card per property, priority, no favorites

### Task 3: Portfolio card + timeline UI

**Files:**
- `components/tenant/PortfolioPropertyCard.tsx`
- `components/tenant/PropertyTimeline.tsx`
- Timeline event builder in `lib/portfolio.ts` (`listPropertyTimeline(propertyId)`)

### Task 4: Routes

**Files:**
- Rewrite `(tabs)/locations.tsx` → list only
- Create `app/portfolio/[propertyId]/index.tsx` (timeline)
- Create `app/portfolio/[propertyId]/rent.tsx` (hub from existing pieces)
- Register in `_layout.tsx`

### Task 5: Wire dates into rent hub

- [x] TenantRentCard / schedule rows use `formatDueLabel` / `formatDateFr`
- [x] Hub CTA « Historique du bien »

### Task 6: Verify

- [x] Unit tests pass
- [ ] Manual: list → rent vs timeline
