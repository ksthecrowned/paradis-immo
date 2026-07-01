# Paradis Immo — Testing Policy

**Date:** 2026-06-29  
**Status:** Approved  
**Applies to:** `apps/web`, `apps/mobile`, `apps/api`

---

## Policy

**Automated tests are API-only for MVP.**

| App | Unit / integration tests | E2E automated | Manual QA |
|---|---|---|---|
| **API** (`apps/api`) | ✅ Required (Jest) | ✅ Critical flows in `apps/api/test/` | Integrations (Infobip, Mobile Money, R2) |
| **Web** (`apps/web`) | ❌ None | ❌ None | Visual checklist, browser smoke tests |
| **Mobile** (`apps/mobile`) | ❌ None | ❌ None | Device / Expo smoke tests |

---

## Rationale

- Business rules and data integrity live in the API — highest ROI for automated coverage.
- Web and mobile are presentation layers consuming a typed OpenAPI contract; manual visual QA is sufficient at MVP, especially while the Darkone dashboard shell is evolving.
- Avoids maintaining Jest + React test harnesses in two frontends.

---

## API testing expectations (unchanged)

- **Unit tests** per domain module (payments, mandates, rent schedules, visits, etc.)
- **Integration / e2e tests** in `apps/api/test/` for critical flows:
  - OTP auth
  - Payment validation (cash + Mobile Money webhook)
  - Lease activation → rent schedule generation
  - Mandate approval blocking lease activation
  - Visit booking (free / paid)
  - Booking overlap rejection
- Run: `pnpm --filter api test` and `pnpm --filter api test:e2e`

---

## Frontend quality gates (replacement for automated tests)

**Web**

- `pnpm --filter web build` must pass (TypeScript + Next.js)
- `pnpm --filter web lint` must pass
- Manual checklist per release (dashboard shell, redirects, login OTP, key CRUD pages)

**Mobile**

- `pnpm --filter mobile` typecheck / Expo start without errors
- Manual smoke on target device (marketplace browse, login, one booking path)

---

## Out of scope

- Visual regression tools (Chromatic, Percy)
- Playwright / Cypress for web
- React Native Testing Library
- Re-introducing frontend unit tests before v1.1 unless policy is explicitly revised

---

## Parent spec amendments

Section **12. Testing strategy** of `2026-06-27-paradis-immo-design.md` is superseded by this document.

All implementation plans must **not** include frontend test tasks (no Jest in web/mobile, no `renderToStaticMarkup` component tests).
