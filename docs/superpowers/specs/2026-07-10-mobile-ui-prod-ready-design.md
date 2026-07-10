# Mobile UI Prod-Ready — Design Spec

**Date:** 2026-07-10  
**Status:** Approved in brainstorming  
**Branch reference:** `origin/old` (UX patterns, not mock data or blue `#3b82f6` drift)

## Goal

Ship a **production-ready mobile app** (Expo, `apps/mobile`) for the Congo public launch: French copy, real API data only, complete tenant/buyer journeys, and polished UI that combines:

1. **UX patterns** from the legacy app on `origin/old` (headers, tab bar, carousel, property detail sheet).
2. **Property card fidelity** from the Estatery kit (price row, badge, meta icons).
3. **Brand tokens** extracted from the Paradis Immo logo (`#7065F0`), unified across mobile (and aligned with web landing).

Success = a real user can browse anonymously, open a listing, log in when needed, favorite, book a visit or short stay, submit a sale inquiry, pay when required, and track activity — without mock UI, English leftovers, or auth walls on browse.

## Non-goals (launch C cut)

- Owner / agent / admin mobile surfaces (web only)
- Alerte immo modal from old branch
- Full profile / settings screen from old branch
- Google Maps search integration from old branch
- Mobile dark mode (light-only documented)
- i18n framework / English locale
- Automated mobile UI E2E suite (manual smoke checklist required)
- Pixel-perfect Playwright loop (web skill; not applicable)

## Launch bar (level C)

| Criterion | Required |
|-----------|----------|
| Language | French 100 % UI copy |
| Data | Zero mock/demo rows in production UI |
| Browse | Anonymous home + explorer + property detail |
| Auth | OTP only when action requires it |
| Accessibility | Touch ≥ 44pt; `accessibilityLabel` on interactives |
| Errors | Retry on all primary data screens |
| Performance | No N+1 media fetch on home list (API `primaryImageUrl` or batch) |

## Actors & surfaces

| Actor | Surface | Purpose |
|-------|---------|---------|
| Anonymous | Onboarding, Home, Explorer, Property detail | Discover listings |
| Tenant / buyer | Favoris, visit book, short-stay book, sale inquiry, payment, Activité | Complete journeys |
| Authenticated | OTP login | Session for protected actions |

### Tab navigation (target)

Inspired by `origin/old` floating tab bar with icons; merged with current API-backed tabs:

| Tab | Route | Auth |
|-----|-------|------|
| Accueil | `(tabs)/index` | No |
| Explorer | `(tabs)/explore` (new) | No |
| Favoris | `(tabs)/favorites` | Yes → `/login` |
| Activité | `(tabs)/activity` | Yes → `/login` |

**Removed from old (post-launch):** Alerte immo center button, Profil tab (activity covers post-auth hub for C).

## Architecture

```
apps/mobile
├── Public stack
│   ├── onboarding (first launch)
│   ├── (tabs)/index      → Home B
│   ├── (tabs)/explore    → filtered list + search modal
│   └── property/[id]     → detail (read-only when anonymous)
├── Auth gate (ensureAuthenticated)
│   ├── favorites
│   ├── property/[id]/visit | book
│   ├── payment/[id]
│   └── (tabs)/activity
└── apiFetch → Nest /api/v1 (anonymous for public property reads)
```

**Implementation approach:** Design system first (kit components + tokens), then screens — not screen-by-screen polish without shared primitives.

**Skills to apply during implementation:**

- `ui-mobile` — touch targets, contrast, a11y, pressed states
- `expo-native-ui` — native feel, Reanimated, `expo-image`, safe areas
- Do **not** use `pixel-perfect-ui` (Next.js web only)

## Brand tokens (option D — logo-driven)

Source: `resources/logo-paradis-immo.png`, `apps/web/public/landing/logo.svg`.

| Token | Value | Usage |
|-------|-------|-------|
| `primary` | `#7065F0` | Logo house, prices, active tab, CTAs |
| `primaryHover` | `#5A50D6` | Pressed primary buttons |
| `primarySoft` | `#E8E6F9` | Chips, subtle fills |
| `primaryMuted` | `#F0EFFB` | Screen bg accents, search fields |
| `navy` | `#100A55` | Secondary CTAs (e.g. « Voir plus ») |
| `ink` | `#000929` | Titles |
| `muted` | `#6C727F` | Location, meta values |
| `border` | `#E0DEF7` | Dividers, card borders |
| `surface` | `#FFFFFF` | Cards |
| `bg` | `#F7F7FD` | Screen background |

**Correction vs `origin/old`:** Replace hardcoded `blue-500` / `#3b82f6` with logo tokens when porting headers and patterns (`ParadisPatterns` uses `primary` at ~50 % opacity, not `bg-blue-400`).

**Single source:** `apps/mobile/constants/theme.ts` (existing); add `resources/brand-tokens.md` pointer in `figma-design.md` when tokens are finalized.

## Home (option B)

```
┌─────────────────────────────────────┐
│ PrimaryHeader (parallax, logo tone) │
│  Search input + filter button       │
├─────────────────────────────────────┤
│ ModeTabs: Louer | Acheter | Vendre │
│  → filters listProperties.mode      │
│  Vendre → CTA web / « bientôt »     │
├─────────────────────────────────────┤
│ FeaturedCarousel (PagerView)        │
│  5–8 items, PropertyCard width~300  │
├─────────────────────────────────────┤
│ Section « Recommandations »         │
│  Vertical FlatList PropertyCard     │
└─────────────────────────────────────┘
```

**Mode mapping:**

| UI | API `mode` |
|----|------------|
| Louer | `RENT_LONG` (optional sub-filter `RENT_SHORT` in filters modal) |
| Acheter | `SALE` |
| Vendre | No browse mode — CTA only |

## Component kit (port + new)

| Component | Source | Notes |
|-----------|--------|-------|
| `PropertyCard` | Estatery layout + API data | Exists; FR badge « Populaire »; favoris |
| `HomeModeTabs` | Estatery segmented + old tiles | New |
| `FeaturedCarousel` | old `FeaturedProperties` | PagerView + API |
| `PrimaryHeader` | old `PrimaryHeader` | Reanimated collapse; logo tokens |
| `ParadiScrollView` | old | Scroll + header sync |
| `FloatingTabBar` / `TabButton` | old `(tabs)/_layout` | Icons Ionicons |
| `PropertyDetailHero` | old `properties/[id]` | Hero 400–450px, thumb strip, sheet |
| `SearchFiltersModal` | old `search-filters` | Wire to `LocationFilter` logic |
| `ScreenStates` | Extend `EmptyState`, `ScreenLoading` | Error + retry everywhere |

**Styling:** StyleSheet + `theme.ts` (no NativeWind dependency for C unless team explicitly adds it later).

## Functional flows

### 1. Onboarding

- First launch only; skip allowed; persisted flag (existing).
- Replace emoji slides with brand imagery when assets available; French copy required.

### 2. Browse (anonymous)

- Home + Explorer + property detail readable without login.
- Pull-to-refresh; skeleton loaders for carousel and list.
- Images from `primaryImageUrl` on list DTO (API change) or capped parallel media fetch documented as interim.

### 3. Favoris

- Login on tab open or heart tap (`ensureAuthenticated`).
- `PropertyCard` with `favorited` + toggle.
- Empty state with CTA « Parcourir les annonces ».

### 4. Property detail

- Mode-specific CTAs (existing): visit, book, sale inquiry.
- Hero gallery, floating back / favorite / share (share optional C).
- Content sheet overlapping hero (old `-mt-8` pattern).
- Error: `EmptyState` + retry (replace red text only).

### 5. Visit / book / sale

- Keep existing routes; polish forms with shared `Input`, `Button`.
- Loading/disabled on submit; French validation messages.

### 6. Payment

- Existing `payment/[id]`; clear success/failure states.

### 7. Activité

- Keep 5 segments; fix loading gate for all segments before show.
- Real API only; empty states per segment.

## API dependencies

| Need | Endpoint / change | Priority |
|------|-------------------|----------|
| Listings | `GET /properties?status=ACTIVE` | Exists |
| Primary image on list | Add `primaryImageUrl` to public property DTO or `GET /properties?include=primaryMedia` | P0 for perf |
| Favoris | `/favorites` | Exists |
| Visits / bookings / sales / payments / leases | Existing mobile libs | Exists |

## Error handling

Every screen that fetches data must support:

1. **Loading** — skeleton or `ScreenLoading` on first paint.
2. **Error** — French message + « Réessayer » calling same loader.
3. **Empty** — `EmptyState` with contextual CTA.

Apply to: home, explore, favorites, property detail, activity (all tabs).

## Accessibility (`ui-mobile`)

- Minimum 44×44 pt for buttons, icon buttons, tab items, filter chips.
- `accessibilityRole` + `accessibilityLabel` on all `Pressable` without visible text.
- Contrast: body text on `surface`/`bg` ≥ 4.5:1; large titles ≥ 3:1.
- `pressed` opacity or scale on all touchables.

## Acceptance checklist (launch C)

- [ ] French 100 % (no POPULAR, Lorem, English nav)
- [ ] Anonymous browse: home, explore, property detail
- [ ] Home B: mode tabs + carousel + vertical list, all API-backed
- [ ] Logo tokens on header, tabs, cards (no old blue)
- [ ] Floating tab bar with icons (port from old)
- [ ] PropertyCard Estatery layout + real prices/locations
- [ ] Property detail hero/sheet pattern from old
- [ ] Favoris → login → toggle works
- [ ] Visit + short-stay + sale inquiry end-to-end on seed data
- [ ] Payment + activity reflect real user actions
- [ ] Error retry on home, explore, detail, favorites, activity
- [ ] Touch/a11y pass on home, card, detail, tabs, login
- [ ] Home list does not fire 20 sequential `listMedia` calls (API or batch fix)
- [ ] Manual smoke: README mobile section updated

## Out of scope reminders

- Web dashboard demo charts (separate web spec)
- Landing page English blocks (web marketing track)
- `origin/old` signup email flow (OTP only)

## References

- Legacy UX: `git show origin/old:app/(tabs)/index.tsx`, `components/layout/PrimaryHeader.tsx`, `components/home/FeaturedProperties.tsx`, `app/properties/[id]/index.tsx`
- Estatery kit: `resources/figma-design.md`
- Current mobile: `apps/mobile/`
- Web product context: `docs/superpowers/specs/2026-07-04-web-mvp-product-design.md`
