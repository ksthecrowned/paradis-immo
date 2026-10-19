# Copilot instructions for Paradis Immo

## Repository shape

This is a three-application real-estate platform:

- `apps/api` is the NestJS/Prisma backend and the source of truth for business rules, authorization, persistence, and API contracts.
- `apps/web` is the Next.js public listing site and the authenticated management portal for owners, agents, and platform admins.
- `apps/mobile` is the Expo client app for property seekers, tenants, guests, and buyers; it is not a management console.

The clients communicate with the API over versioned HTTP (`/api/v1`). OpenAPI is exported from the API and client types are generated from that contract; generated types are not the source of business rules. PostgreSQL schema and migrations are under `apps/api/prisma/`.

For a change, identify every affected surface (API, web, mobile, database, events, and docs) and keep consumers aligned with the server contract. Architecture maps are in `docs/ARCHITECTURE.md`, `docs/architecture/api.md`, and `docs/architecture/clients.md`.

## Build, test, and lint

Run root scripts from the repository root. The root `package.json` delegates to application scripts; its build covers the API and web, not mobile.

```powershell
pnpm build
pnpm test
pnpm test:e2e
pnpm lint
pnpm export:openapi
pnpm generate:types
pnpm docs:check
```

API scripts use Bun as declared in `apps/api/package.json`. From `apps/api`, run one Jest test file by passing its path relative to Jest's `src` root:

```powershell
bun run test -- --runInBand properties/properties.spec.ts
```

API unit/integration tests are in `apps/api/src/**/*.spec.ts`; E2E flows are in `apps/api/test/flows/` and use a separate Jest config. E2E tests may require a dedicated database and environment; inspect their setup before running them. `bun run lint` in the API runs ESLint with `--fix`.

Web scripts are in `apps/web/package.json`: `bun run lint` and `bun run build`. The web and mobile manifests do not declare a standard test script. Mobile Expo commands include `bun run start`, `bun run android`, `bun run ios`, and `bun run web`; check for an existing targeted test before assuming a test runner is available.

## Working conventions

- Read `README.md`, `docs/README.md`, and `docs/ARCHITECTURE.md` first. Use `CLAUDE.md` and `.skills/README.md` to route the task to the relevant product spec and only 1–3 focused skills. Specs describe intended behavior, not proof of current implementation; verify the code.
- Authorization belongs in the API. Never treat a client-supplied ID, role, organization, route guard, or hidden UI control as permission. For managed property access, inspect and reuse the applicable shared access service (including `AgencyAccessService`) and test both allowed and denied scopes.
- In API domains, keep controllers focused on the HTTP contract and delegation; put business rules in domain services and validate input with DTOs. The global validation pipe rejects undeclared fields. Verify the actual endpoint response and pagination contract rather than assuming one universal shape.
- Preserve distinct loading, empty, error, and success states in clients. Use existing API/domain clients (`apps/web/lib/api.ts` and `apps/mobile/lib/`) so authentication, refresh, error handling, and pagination behavior stay consistent; do not turn API failures into empty data or success.
- The web session is for management routes. Before changing Next.js code, read the relevant guide in `apps/web/node_modules/next/dist/docs/`; this repository's installed Next.js version has breaking changes. Never expose server secrets through `NEXT_PUBLIC_*`.
- Mobile is for end users. Keep tokens in Expo SecureStore (not AsyncStorage), preserve refresh/logout behavior, and treat deep links as navigation rather than authorization.
- A Prisma schema change needs a migration, regenerated client, and targeted tests. Review transaction boundaries, uniqueness/concurrency, emitted events, and downstream handlers for multi-step domain changes.
- Financial mutations must preserve amount/currency, idempotency, ledger, and audit invariants. Do not run remote migrations, real payments, payouts, or storage operations without explicit authorization and the documented procedure.
- When an API contract changes, update affected web/mobile consumers and regenerate OpenAPI-derived types as appropriate. Update directly affected specs, architecture docs, or skills; use an ADR for cross-domain or hard-to-reverse decisions.
- Do not commit or expose secrets, tokens, OTPs, real personal data, or real documents. Do not claim a feature is production-ready based only on a local build or a spec.

For repository-wide contribution and worktree rules, see `AGENTS.md` and `CONTRIBUTING.md`; application-specific instructions are in `apps/api/AGENTS.md`, `apps/web/AGENTS.md`, and `apps/mobile/AGENTS.md`.
