# Web Email / Google Auth + Role Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace web phone OTP with email magic-link + password and Google; require Owner/Agent role selection before dashboards; keep mobile OTP unchanged.

**Architecture:** Nest issues JWT access/refresh as today. Web NextAuth uses Credentials (`web-password`) + Google that call Nest `/auth/web/*`. Magic links stored hashed in Postgres. After login, `proxy.ts` redirects users without org Owner/Agent (and without `PLATFORM_ADMIN`) to `/onboarding/role`.

**Tech Stack:** NestJS, Prisma, Next.js App Router, NextAuth v5, existing `password.util.ts` (scrypt), `google-auth-library`, Infobip optional for email (console fallback in dev).

**Spec:** `docs/superpowers/specs/2026-07-12-web-email-google-auth-design.md`

## Global Constraints

- No phone OTP on web UI or web login path.
- Mobile `POST /auth/otp/*` unchanged.
- `PLATFORM_ADMIN` never self-serve via role picker.
- Phone optional on `User` for web-only accounts.
- Agent self-serve joins platform org `PARADIS_IMMO_ORG_ID` as `OrgMemberRole.AGENT`.
- Owner self-serve creates `OrganizationType.OWNER` + `OrgMemberRole.OWNER`.
- Fold prior `/auth/admin/*` and `/admin/login` into `/auth/web/*` and `/login`.

## File map

| Path | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | `emailVerifiedAt`, nullable `phone`, `EmailMagicLink` model |
| `apps/api/prisma/migrations/…` | SQL migration |
| `apps/api/src/auth/password.util.ts` | Existing scrypt helpers (reuse) |
| `apps/api/src/auth/magic-link.store.ts` | Create/consume/resend hashed magic links |
| `apps/api/src/auth/email.service.ts` | Send magic link (Infobip or console) |
| `apps/api/src/auth/web-auth.service.ts` | Register, magic, login, google, setRole |
| `apps/api/src/auth/auth.controller.ts` | Wire `/auth/web/*`; deprecate admin-only routes |
| `apps/api/src/auth/dto/web-*.dto.ts` | DTOs |
| `apps/api/src/auth/web-auth.service.spec.ts` | Integration-style unit tests |
| `apps/api/src/common/constants/seed-ids.ts` | `PARADIS_IMMO_ORG_ID` for agent attach |
| `apps/web/lib/backend-auth.ts` | Nest client helpers for web auth |
| `apps/web/auth.ts` | Providers + jwt callbacks |
| `apps/web/proxy.ts` | Active-account gate |
| `apps/web/app/login/page.tsx` | Email/password + Google |
| `apps/web/app/register/page.tsx` | Email signup |
| `apps/web/app/auth/magic/page.tsx` | Consume token + set password |
| `apps/web/app/onboarding/role/page.tsx` | Owner \| Agent |
| Remove / redirect | `apps/web/app/admin/login/page.tsx` → `/login` |

---

### Task 1: Schema — nullable phone, emailVerifiedAt, EmailMagicLink

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260712190000_web_email_auth/migration.sql`
- Modify: seed if needed after generate

**Interfaces:**
- Produces: `User.emailVerifiedAt DateTime?`, `User.phone String?`, model `EmailMagicLink`

- [ ] **Step 1: Update Prisma User + add EmailMagicLink**

On `User`:
```prisma
phone            String?
emailVerifiedAt  DateTime?
```
Keep `email String? @unique`, `passwordHash`, `googleId` as already present.

Add:
```prisma
enum MagicLinkPurpose {
  VERIFY_EMAIL
  RESET_PASSWORD
}

model EmailMagicLink {
  id        String           @id @default(cuid())
  email     String
  tokenHash String           @unique
  purpose   MagicLinkPurpose
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime         @default(now())

  @@index([email, purpose])
}
```

- [ ] **Step 2: Write migration SQL**

```sql
ALTER TABLE "User" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

CREATE TYPE "MagicLinkPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

CREATE TABLE "EmailMagicLink" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "purpose" "MagicLinkPurpose" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailMagicLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailMagicLink_tokenHash_key" ON "EmailMagicLink"("tokenHash");
CREATE INDEX "EmailMagicLink_email_purpose_idx" ON "EmailMagicLink"("email", "purpose");
```

- [ ] **Step 3: Generate + migrate**

Run: `cd apps/api && bunx prisma generate && bunx prisma migrate deploy`  
Expected: success

- [ ] **Step 4: Fix OTP paths that assume phone non-null**

Grep `user.phone` / create user with phone in `auth.service.ts` — OTP create still requires phone; no change to OTP create signature. Ensure TypeScript compiles with optional phone on `PublicUser.phone: string | null`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma
git commit -m "feat(api): schema for web email auth and magic links"
```

---

### Task 2: Magic link store + email sender

**Files:**
- Create: `apps/api/src/auth/magic-link.store.ts`
- Create: `apps/api/src/auth/email.service.ts`
- Modify: `apps/api/src/auth/auth.module.ts`

**Interfaces:**
- Produces:
  - `MagicLinkStore.create(email, purpose): Promise<{ rawToken: string }>`
  - `MagicLinkStore.consume(rawToken, purpose): Promise<{ email: string }>`
  - `EmailService.sendMagicLink(email, rawToken, purpose): Promise<void>`

- [ ] **Step 1: Implement MagicLinkStore**

```typescript
// apps/api/src/auth/magic-link.store.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { MagicLinkPurpose } from '@prisma/client';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

const TTL_MS = 30 * 60 * 1000;

@Injectable()
export class MagicLinkStore {
  constructor(private readonly prisma: PrismaService) {}

  private hash(raw: string): string {
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  async create(
    email: string,
    purpose: MagicLinkPurpose,
  ): Promise<{ rawToken: string }> {
    const normalized = email.trim().toLowerCase();
    const rawToken = crypto.randomBytes(32).toString('base64url');
    await this.prisma.emailMagicLink.create({
      data: {
        email: normalized,
        tokenHash: this.hash(rawToken),
        purpose,
        expiresAt: new Date(Date.now() + TTL_MS),
      },
    });
    return { rawToken };
  }

  async consume(
    rawToken: string,
    purpose: MagicLinkPurpose,
  ): Promise<{ email: string }> {
    const row = await this.prisma.emailMagicLink.findUnique({
      where: { tokenHash: this.hash(rawToken) },
    });
    if (!row || row.purpose !== purpose || row.usedAt || row.expiresAt < new Date()) {
      throw new UnauthorizedException({
        code: 'MAGIC_LINK_INVALID',
        message: 'Lien invalide ou expiré',
      });
    }
    await this.prisma.emailMagicLink.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
    return { email: row.email };
  }
}
```

- [ ] **Step 2: Implement EmailService (console fallback)**

```typescript
// apps/api/src/auth/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { MagicLinkPurpose } from '@prisma/client';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  async sendMagicLink(
    email: string,
    rawToken: string,
    purpose: MagicLinkPurpose,
  ): Promise<void> {
    const base = process.env.WEB_APP_URL ?? 'http://localhost:3000';
    const url = `${base}/auth/magic?token=${encodeURIComponent(rawToken)}&purpose=${purpose}`;
    // MVP: always log; optional Infobip email later
    this.logger.log(`[dev] Magic link for ${email} (${purpose}): ${url}`);
  }
}
```

- [ ] **Step 3: Register providers in AuthModule**

Add `MagicLinkStore`, `EmailService` to `providers` and export if needed.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/magic-link.store.ts apps/api/src/auth/email.service.ts apps/api/src/auth/auth.module.ts
git commit -m "feat(api): magic link store and email sender"
```

---

### Task 3: WebAuthService — register, magic consume, login, google, setRole

**Files:**
- Create: `apps/api/src/auth/web-auth.service.ts`
- Create: `apps/api/src/auth/dto/web-register.dto.ts`, `web-magic-consume.dto.ts`, `web-login.dto.ts`, `web-google.dto.ts`, `web-role.dto.ts`
- Modify: `apps/api/src/auth/auth.controller.ts`
- Modify: `apps/api/src/auth/auth.service.ts` — keep OTP; share `issueTokens` / `toPublicUser` (extract protected/public helpers or inject AuthService methods)
- Create: `apps/api/src/auth/web-auth.service.spec.ts`
- Modify: `apps/api/.env.example` — `WEB_APP_URL`, `GOOGLE_CLIENT_ID`

**Interfaces:**
- Consumes: `MagicLinkStore`, `EmailService`, `hashPassword`/`verifyPassword`, `PARADIS_IMMO_ORG_ID`
- Produces: same `AuthTokens` shape as OTP (`accessToken`, `refreshToken`, `user`)

**Preferred structure:** Move `issueTokens` + `toPublicUser` to shared methods on `AuthService` marked public, call from `WebAuthService`; **or** put web methods on `AuthService` to avoid duplication. Prefer extending `AuthService` with `registerWeb`, `consumeMagic`, `loginWeb`, `loginGoogleWeb`, `setWebRole` if file size stays readable; else `WebAuthService` with injected helpers.

- [ ] **Step 1: Write failing tests** in `web-auth.service.spec.ts`

```typescript
describe('WebAuthService', () => {
  it('register creates user and magic link', async () => {
    await service.registerWeb({ email: 'owner@example.com' });
    const user = await prisma.user.findUnique({ where: { email: 'owner@example.com' } });
    expect(user).toBeTruthy();
    expect(user!.emailVerifiedAt).toBeNull();
    const links = await prisma.emailMagicLink.findMany({ where: { email: 'owner@example.com' } });
    expect(links.length).toBeGreaterThan(0);
  });

  it('login rejects unverified email', async () => {
    await expect(
      service.loginWeb({ email: 'owner@example.com', password: 'Password1!' }),
    ).rejects.toThrow();
  });

  it('setWebRole OWNER creates owner org', async () => {
    // after verified user exists with tokens path — call setWebRole
  });

  it('setWebRole rejects PLATFORM_ADMIN string', async () => {
    // 403
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/api && bunx jest src/auth/web-auth.service.spec.ts --runInBand`  
Expected: fail (service/methods missing)

- [ ] **Step 3: Implement registerWeb**

```typescript
async registerWeb(input: { email: string }): Promise<{ message: string }> {
  const email = input.email.trim().toLowerCase();
  const country = await this.prisma.country.findUniqueOrThrow({ where: { code: 'CG' } });
  let user = await this.prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await this.prisma.user.create({
      data: { email, countryId: country.id, phone: null },
    });
  }
  if (user.emailVerifiedAt) {
    // still send login-ish magic or generic message to avoid enumeration
  }
  const { rawToken } = await this.magicLinks.create(email, 'VERIFY_EMAIL');
  await this.email.sendMagicLink(email, rawToken, 'VERIFY_EMAIL');
  return { message: 'Si cet email est valide, un lien a été envoyé' };
}
```

- [ ] **Step 4: Implement consumeMagic**

```typescript
async consumeMagic(input: { token: string; password: string }): Promise<AuthTokens> {
  const { email } = await this.magicLinks.consume(input.token, 'VERIFY_EMAIL');
  if (input.password.length < 8) {
    throw new BadRequestException({ code: 'PASSWORD_TOO_SHORT', message: '8 caractères minimum' });
  }
  const passwordHash = await hashPassword(input.password);
  const user = await this.prisma.user.update({
    where: { email },
    data: { emailVerifiedAt: new Date(), passwordHash },
    include: { roles: true },
  });
  const tokens = await this.issueTokens(user);
  return { ...tokens, user: this.toPublicUser(user) };
}
```

- [ ] **Step 5: Implement loginWeb**

Require `emailVerifiedAt` + `passwordHash` + `verifyPassword`. Return JWTs. Do **not** require org role here (gate is web proxy).

- [ ] **Step 6: Implement loginGoogleWeb**

Reuse Google verify from existing `loginAdminGoogle` logic but **do not** require `PLATFORM_ADMIN`. Upsert user by email, set `emailVerifiedAt`, `googleId`.

- [ ] **Step 7: Implement setWebRole**

```typescript
async setWebRole(userId: string, role: 'OWNER' | 'AGENT'): Promise<AuthTokens> {
  const user = await this.prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: true, orgMembers: true },
  });
  if (user.roles.some((r) => r.role === 'PLATFORM_ADMIN')) {
    return { ...(await this.issueTokens(user)), user: this.toPublicUser(user) };
  }
  const hasBiz = user.orgMembers.some((m) => m.role === 'OWNER' || m.role === 'AGENT');
  if (hasBiz) {
    throw new ConflictException({ code: 'ROLE_ALREADY_SET', message: 'Rôle déjà défini' });
  }
  if (role === 'OWNER') {
    await this.prisma.organization.create({
      data: {
        name: user.name ? `${user.name} (propriétaire)` : 'Mon organisation',
        type: 'OWNER',
        countryId: user.countryId,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
  } else {
    await this.prisma.organizationMember.create({
      data: {
        userId: user.id,
        organizationId: PARADIS_IMMO_ORG_ID,
        role: 'AGENT',
      },
    });
  }
  const refreshed = await this.prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roles: true },
  });
  const tokens = await this.issueTokens(refreshed);
  return { ...tokens, user: this.toPublicUser(refreshed) };
}
```

- [ ] **Step 8: Controller routes**

```typescript
@Post('web/register') // 202
@Post('web/magic/consume')
@Post('web/magic/resend')
@Post('web/login')
@Post('web/google')
@Post('web/role') // JwtAuthGuard
```

Keep `admin/login` as thin wrappers calling `loginWeb` + assert PLATFORM_ADMIN **or** remove and update web only.

- [ ] **Step 9: Run tests — expect PASS**

Run: `cd apps/api && bunx jest src/auth/web-auth.service.spec.ts --runInBand`

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/auth apps/api/.env.example
git commit -m "feat(api): web register, magic link, login, google, role"
```

---

### Task 4: NextAuth + backend-auth client

**Files:**
- Modify: `apps/web/lib/backend-auth.ts`
- Modify: `apps/web/auth.ts`
- Modify: `apps/web/types/next-auth.d.ts`
- Modify: `apps/web/lib/auth.ts`

**Interfaces:**
- Produces: `backendWebRegister`, `backendWebMagicConsume`, `backendWebLogin`, `backendWebGoogle`, `backendWebSetRole`, `backendWebResendMagic`

- [ ] **Step 1: Add Nest client functions** mirroring OTP helpers (same unwrapTokens).

- [ ] **Step 2: Replace NextAuth providers**

- Keep Google when configured.
- Replace `admin-password` with `web-password` calling `backendWebLogin`.
- Remove `otp` provider from web `auth.ts` (mobile does not use NextAuth).
- Google `signIn` / `jwt` call `backendWebGoogle` (not admin-only).

- [ ] **Step 3: Session user** — include `email`, `phone: string | null`, `roles`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/backend-auth.ts apps/web/auth.ts apps/web/types/next-auth.d.ts apps/web/lib/auth.ts
git commit -m "feat(web): NextAuth web-password and Google via Nest"
```

---

### Task 5: Active-account helper + proxy gate

**Files:**
- Create: `apps/web/lib/web-account.ts`
- Modify: `apps/web/proxy.ts`
- Modify: `apps/web/lib/me.ts` if needed for org roles in session

**Problem:** JWT today only has global `roles`, not org membership. Role gate needs to know Owner/Agent.

**Solution (pick one in implementation — preferred A):**

**A)** Extend Nest `PublicUser` / JWT payload with `orgRoles: Array<'OWNER'|'AGENT'>` (from `orgMembers`) so session carries it after login and after `setWebRole` (re-issue tokens).

**B)** `proxy` calls `/users/me/organizations` — slower, needs token.

Plan mandates **A**:

- [ ] **Step 1: Extend API PublicUser + JWT optional claim or session hydration**

Simplest MVP without changing JWT shape: after login, web calls `GET /users/me/organizations` once in `jwt` callback when `user` is set and stores `orgRoles` on token. Also after `setWebRole`, refresh session.

Or add to Nest token response user object:

```typescript
orgRoles: string[]; // 'OWNER' | 'AGENT' from orgMembers
```

Update `toPublicUser` to include `orgRoles`.

- [ ] **Step 2: `isWebAccountActive(user)`**

```typescript
export function isWebAccountActive(user: {
  roles: string[];
  orgRoles?: string[];
}): boolean {
  if (user.roles.includes('PLATFORM_ADMIN')) return true;
  const org = user.orgRoles ?? [];
  return org.includes('OWNER') || org.includes('AGENT');
}
```

- [ ] **Step 3: Update proxy**

```typescript
const AUTH_OPEN = ['/login', '/register', '/auth/magic', '/onboarding/role', '/admin/login'];
// if authenticated && !isWebAccountActive && !AUTH_OPEN.includes → /onboarding/role
// unauthenticated protected → /login
// remove special /admin/login-only admin password path; redirect /admin/login → /login
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth apps/web/lib/web-account.ts apps/web/proxy.ts apps/web/types
git commit -m "feat(web): active-account gate using orgRoles"
```

---

### Task 6: Web pages — login, register, magic, onboarding role

**Files:**
- Rewrite: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/register/page.tsx`
- Create: `apps/web/app/auth/magic/page.tsx`
- Create: `apps/web/app/onboarding/role/page.tsx`
- Delete or redirect: `apps/web/app/admin/login/page.tsx` → `redirect('/login')`
- Update: `apps/web/lib/dev-test-accounts.ts` — admin email/password hint only

- [ ] **Step 1: `/register`** — form email → `backendWebRegister` → “Vérifiez votre boîte” (dev: tell user to check API logs).

- [ ] **Step 2: `/auth/magic`** — read `token` query → password form (min 8) → `signIn` after `backendWebMagicConsume` **or** Credentials that accept pre-issued tokens.

**Preferred:** magic page calls Nest consume, then `signIn('web-password', { email, password })` with the password just set (login works because verified).

- [ ] **Step 3: `/login`** — email/password `signIn('web-password')` + Google button; link to `/register`; no phone OTP UI.

- [ ] **Step 4: `/onboarding/role`** — two buttons; `backendWebSetRole` with Bearer access token; `getSession` refresh / `router.refresh()`; navigate owner vs agent dashboard.

- [ ] **Step 5: Manual smoke** (API + web running)

1. Register `test@example.com` → copy magic URL from API log → set password → choose Owner → see `/owner/dashboard`.
2. Logout → login password.
3. Seed admin `admin@paradisimmo.cg` / `Admin123!` → `/admin/dashboard` without role picker.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app
git commit -m "feat(web): email/Google login, magic link, role onboarding"
```

---

### Task 7: Seed + docs cleanup

**Files:**
- Modify: `apps/api/prisma/seed.ts` — set `emailVerifiedAt: new Date()` on admin + owner + agent seed users with emails/passwords for local web login
- Modify: `apps/api/.env.example`, root README snippet if auth docs mention web OTP
- Modify: `docs/superpowers/specs/2026-07-04-web-mvp-product-design.md` auth bullet (optional one-line update)

- [ ] **Step 1: Seed owner/agent with email+password+verified** for local web testing (document passwords in seed console).

Example:
- owner: `owner@paradisimmo.cg` / `Owner123!`
- agent: `agent@paradisimmo.cg` / `Agent123!`
- admin: existing

- [ ] **Step 2: Re-seed**

Run: `cd apps/api && bun run prisma:seed`

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/seed.ts apps/api/.env.example README.md
git commit -m "chore(seed): web emails for owner/agent/admin"
```

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| No web OTP | 4, 6 |
| Magic link verify | 2, 3, 6 |
| Password login | 3, 4, 6 |
| Google all web users | 3, 4, 6 |
| Role Owner/Agent required | 3, 5, 6 |
| No self-serve PLATFORM_ADMIN | 3 |
| Phone optional web | 1, 3 |
| Mobile OTP unchanged | 3 (leave otp routes) |
| Fold admin login | 6 |
| Agent → Paradis Immo org | 3 |
| Owner org create | 3 |

## Placeholder / consistency self-review

- No TBD left; Agent org id = `PARADIS_IMMO_ORG_ID`.
- `AuthTokens` / `PublicUser` extended with `orgRoles` in Task 5 — implementers must update unwrap on web in same task.
- Magic purpose query param optional if consume always uses `VERIFY_EMAIL` for MVP.
