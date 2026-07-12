# Web auth — email magic link + Google + role gate

**Date:** 2026-07-12  
**Status:** Approved in brainstorming  
**Scope:** Replace phone OTP on the **web** back-office with email (magic link) + Google; require Owner/Agent role before dashboards. Mobile OTP unchanged.

## Goals

- Everyone who uses the web (owners, agents, platform admins) authenticates with **email** or **Google** — **no phone OTP on web**.
- Email signup is verified via **magic link**.
- After auth, if the account has **no business role**, user must choose **Propriétaire** or **Agent** before the account is active.
- `PLATFORM_ADMIN` is **never** self-serve (seed / ops only).
- Mobile seekers keep **phone + OTP**.

## Non-goals (MVP)

- Dedicated password-reset product flow (optional follow-up via magic `RESET_PASSWORD`).
- Owner inviting agents by email.
- Merging an existing mobile phone-only user with a web email account.
- Changing mobile auth.

## Approach

**Nest remains the token issuer** (access + refresh JWT). NextAuth Credentials / Google call Nest and store Nest JWTs in the session (same pattern as today’s OTP provider).

## User model changes

| Field | Change |
|--------|--------|
| `email` | Unique; required for web accounts |
| `emailVerifiedAt` | Set when magic link consumed or Google verified email |
| `passwordHash` | Set after magic-link password step (or later set-password) |
| `googleId` | Optional, unique |
| `phone` | **Optional** for web-only accounts; still required in practice for mobile OTP users |

Business role = org membership `OWNER` or `AGENT`. Global `PLATFORM_ADMIN` remains a global role, provisioned only.

**Active account (web):** `(emailVerifiedAt OR googleId)` **and** (`PLATFORM_ADMIN` **or** org role Owner/Agent).

## Auth flows

### Email register

1. `POST /auth/web/register` `{ email }` → create user (no role), create magic link (`VERIFY_EMAIL`), send email (Infobip if configured; else console in dev).
2. User opens `/auth/magic?token=…`.
3. `POST /auth/web/magic/consume` `{ token, password }` → verify token one-shot, set `emailVerifiedAt` + `passwordHash`, issue JWTs.
4. If no business role → `/onboarding/role`.

### Email login

1. `POST /auth/web/login` `{ email, password }` → reject if email not verified or bad password.
2. Issue JWTs → role gate → dashboard.

### Google

1. NextAuth Google → Nest `POST /auth/web/google` `{ idToken }`.
2. Upsert/link user by verified email + `googleId`.
3. Issue JWTs → role gate if needed.

### Role selection (blocking)

1. `POST /auth/web/role` `{ role: 'OWNER' | 'AGENT' }` (authenticated).
2. Apply membership:
   - **OWNER:** ensure an `OWNER`-type organization for the user (same pattern as today when publishing first property; create org + `OrgMemberRole.OWNER` at role selection).
   - **AGENT:** add `OrgMemberRole.AGENT` on the platform organization (Paradis Immo / `PLATFORM` type), creating membership if missing. Partner-agency placement stays ops/admin later (out of MVP).
3. Reject `PLATFORM_ADMIN` (403).
4. Redirect: Owner → `/owner/dashboard`, Agent → `/agent/dashboard`.

### Platform admin

- Seeded with email + password (+ optional Google link later).
- Uses same `/login` (no separate self-serve admin registration).
- Skips `/onboarding/role`.

### Mobile

- `POST /auth/otp/*` unchanged.
- Web login UI no longer offers OTP.

## API surface (Nest)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/auth/web/register` | Start email signup + magic link |
| POST | `/auth/web/magic/consume` | Verify link, set password, JWTs |
| POST | `/auth/web/magic/resend` | Resend VERIFY_EMAIL link |
| POST | `/auth/web/login` | Email + password → JWTs |
| POST | `/auth/web/google` | Google ID token → JWTs |
| POST | `/auth/web/role` | Set OWNER or AGENT (auth required) |
| POST | `/auth/otp/*` | Mobile only (unchanged) |

### Magic link storage

Table `EmailMagicLink`: hashed token, email, purpose (`VERIFY_EMAIL` \| `RESET_PASSWORD`), `expiresAt`, `usedAt`, one-shot. TTL ~15–30 minutes.

## Web UI

| Route | Role |
|-------|------|
| `/login` | Password + Google + link to register (no WhatsApp OTP) |
| `/register` | Email only → “check your inbox” |
| `/auth/magic` | Consume token; set password if needed |
| `/onboarding/role` | Owner \| Agent picker (blocking) |
| Remove / fold | `/admin/login` into `/login` |

### `proxy.ts`

- Protect `/owner`, `/agent`, `/admin`.
- Authenticated but **not active** (no admin, no Owner/Agent org) → redirect `/onboarding/role` (except auth/onboarding routes).
- Unauthenticated → `/login?callbackUrl=`.

### NextAuth providers

- `web-password` (email/password via Nest).
- Google (when `AUTH_GOOGLE_*` configured).
- Remove OTP from web `/login` (OTP Credentials may remain unused or deleted from web auth config).

## Errors

| Case | Behavior |
|------|----------|
| Expired / reused magic link | Clear error + resend |
| Login before verify | Reject + resend magic link |
| Google without verified email | Reject |
| Role already set | 409 or idempotent no-op |
| Self-serve PLATFORM_ADMIN | 403 |

## Edge cases

- Same person password + Google → one `User`, link `googleId` on first Google sign-in.
- Mobile phone-only users without email → cannot use web until email linking (out of MVP).
- Seed admin skips role onboarding.

## Testing (smoke)

1. Register → magic (dev log) → set password → choose Owner → `/owner/dashboard`.
2. Google (if configured) → choose Agent → `/agent/dashboard`.
3. Password login → dashboard.
4. Hit `/owner` without role → `/onboarding/role`.
5. Mobile OTP still works.
6. Web has no phone OTP UI.

## Relation to prior admin-only auth

Commit `feat(auth): platform admins sign in with email/password or Google` introduced admin-only endpoints and `/admin/login`. This design **generalizes** that to all web users, magic-link verification, and role onboarding; admin-specific paths should be folded into `/auth/web/*` + `/login`.
