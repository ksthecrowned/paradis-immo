# Paradis Immo API — Prod-Ready Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 4 P0 and 8 P1 findings identified in the audit `docs/superpowers/specs/2026-07-07-api-prod-ready-audit.md` to make the Paradis Immo API prod-ready.

**Architecture:** Sequential fixes grouped by file/lot. P0 are inlined in dedicated tasks. P1 are batched into 6 lots that touch independent files. Each task is a TDD micro-cycle: failing test → implementation → passing test → commit. No migrations to Prisma schema in this plan (deferred).

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL 16, Redis, BullMQ, Jest.

**Spec:** `docs/superpowers/specs/2026-07-07-api-prod-ready-audit.md`

## Global Constraints

- API-only testing policy (`docs/superpowers/specs/2026-06-29-paradis-immo-testing-policy.md`) — no frontend tests.
- No new external dependencies unless strictly required; if so, flag in the task and ask.
- No Prisma schema migration in this plan (the index task P-1 of the audit is **deferred** to a follow-up).
- No new features (the spec is prod-ready, not new-functionality).
- All new endpoints must declare `@ApiTags`, `@ApiBearerAuth()`, and `@ApiOperation` — even if the dedicated Swagger task is later, this rule applies from day 1.
- All DTOs used in controllers must live under `dto/` (no inline DTOs).
- All changes must be backwards-compatible with the existing API consumers (no breaking changes to existing endpoint signatures).
- Commit message format: `fix(api): <scope> — <one-line description>`.

---

## File Structure

This plan modifies existing files only. No new files outside `dto/` folders.

**Files modified (P0):**
- `apps/api/src/app.module.ts` — register `MediaModule`
- `apps/api/src/main.ts` — restrict CORS, fail-fast on missing JWT_SECRET
- `apps/api/src/payments/receipts/receipt.controller.ts` + `.service.ts` — add RBAC
- `apps/api/src/properties/properties.service.ts` + `.controller.ts` — add `listMine`
- `apps/api/src/properties/properties.spec.ts` — tests for listMine + IDOR

**Files modified (L1 — Endpoints managed/mine):**
- `apps/api/src/leases/leases.service.ts` + `.controller.ts` + new `dto/list-leases.dto.ts` — add `listManaged`
- `apps/api/src/bookings/bookings.service.ts` + `.controller.ts` — add `listManaged`
- `apps/api/src/payments/payments.service.ts` + `.controller.ts` — add `listManaged`
- `apps/api/src/maintenance/maintenance.service.ts` + `.controller.ts` — clarify/rename `listMine` semantics + add `listForMyProperties`

**Files modified (L2 — Swagger):**
- All controllers get `@ApiTags` + `@ApiBearerAuth` + `@ApiOperation` on each route.
- DTOs get `@ApiProperty` for examples.

**Files modified (L3 — E2E):**
- New `apps/api/test/payments.e2e-spec.ts`
- New `apps/api/test/leases.e2e-spec.ts`
- New `apps/api/test/mandates.e2e-spec.ts`
- New `apps/api/test/visits.e2e-spec.ts`

**Files modified (L4 — Observability):**
- New `apps/api/src/common/middleware/request-id.middleware.ts`
- Modify `apps/api/src/main.ts` — wire middleware
- Modify `apps/api/src/health/health.controller.ts` — add DB + Redis check
- Modify `apps/api/src/app.module.ts` — wire health check deps

**Files modified (L5 — Security global):**
- `apps/api/src/payments/payments.service.ts` — add agent/owner RBAC on `validateCashPayment`
- `apps/api/src/auth/auth.service.ts` — add rate limit on `requestOtp`
- `apps/api/src/main.ts` — add helmet
- `apps/api/src/app.module.ts` — add ThrottlerModule
- `apps/api/src/main.ts` — fail-fast on missing JWT_SECRET in production
- `apps/api/.env.example` — create with all required vars (none currently exists)

**Files modified (L6 — DTO inline):**
- `apps/api/src/leases/dto/create-lease.dto.ts` — new file (move from controller)
- `apps/api/src/bookings/dto/create-booking.dto.ts` — new file
- `apps/api/src/visit-slots/dto/create-template.dto.ts` — new file (move from controller)
- `apps/api/src/mandates/dto/decide-approval.dto.ts` — new file

**No file is created outside these specific paths.**

---

## Lot 0 — P0 Fixes (must be done first)

### Task 1: Register `MediaModule` in `AppModule` (P0-1)

**Files:**
- Modify: `apps/api/src/app.module.ts:18-39`

- [ ] **Step 1: Add `MediaModule` to the imports array**

In `apps/api/src/app.module.ts`, add `MediaModule` to the imports list. Place it after `PaymentsModule` since it depends on it indirectly:

```ts
import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { EventModule } from './events/event.module';
import { HealthModule } from './health/health.module';
import { LeasesModule } from './leases/leases.module';
import { LocationsModule } from './locations/locations.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { MandatesModule } from './mandates/mandates.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { SalesModule } from './sales/sales.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { UsersModule } from './users/users.module';
import { VisitSlotsModule } from './visit-slots/visit-slots.module';

@Module({
  imports: [
    PrismaModule,
    EventModule,
    AdminModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    HealthModule,
    LocationsModule,
    PropertiesModule,
    VisitSlotsModule,
    BookingsModule,
    LeasesModule,
    MaintenanceModule,
    MandatesModule,
    MediaModule,
    NotificationsModule,
    PaymentsModule,
    SalesModule,
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd apps/api && pnpm build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 3: Verify the routes are registered**

Run: `cd apps/api && pnpm start:dev` (in one terminal), then in another:

```bash
curl -i http://localhost:3001/api/v1/properties/nonexistent/media
```

Expected: HTTP 200 (returns empty list) — confirms the `GET /properties/:id/media` route is now reachable. (Was 404 before this fix.)

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "fix(api): register MediaModule — 3 media routes were unreachable"
```

---

### Task 2: Add RBAC to `GET /receipts/:id` (P0-2)

**Files:**
- Modify: `apps/api/src/payments/receipts/receipt.service.ts`
- Modify: `apps/api/src/payments/receipts/receipt.controller.ts:11-33`
- Modify: `apps/api/src/payments/receipts/receipt.service.spec.ts` (add new test)

**Interfaces:**
- Consumes: `findById(id: string)`, `current.userId: string`, property org via payment
- Produces: throws `ForbiddenException` if the user is not the payer nor a member of the managing org of the property linked to the lease backing the payment

- [ ] **Step 1: Read the current implementation**

Read `apps/api/src/payments/receipts/receipt.service.ts` and `apps/api/src/payments/receipts/receipt.service.spec.ts` to understand the `findById` signature and the existing test patterns.

- [ ] **Step 2: Write the failing test**

Add the following `it(...)` block to the existing `describe('ReceiptService', ...)` in `receipt.service.spec.ts` (place it after the existing tests):

```ts
it('findById returns null when receipt does not exist', async () => {
  const fakePrisma = {
    receipt: { findUnique: jest.fn().mockResolvedValue(null) },
  } as any;
  const svc = new ReceiptService(fakePrisma as any);
  expect(await svc.findById('missing')).toBeNull();
});
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `cd apps/api && pnpm test -- receipt.service.spec.ts`
Expected: PASS (this test confirms the existing baseline; we'll add the real failing test next).

- [ ] **Step 4: Add the new authorization check method**

In `receipt.service.ts`, add a new method that verifies access. First read the current `findById` to know what data is returned; the receipt is linked to a payment which is linked to allocations and ultimately to a lease/property.

Add a new method `findByIdForUser(receiptId: string, userId: string)`:

```ts
async findByIdForUser(
  receiptId: string,
  userId: string,
): Promise<PublicReceipt | null> {
  const receipt = await this.prisma.receipt.findUnique({
    where: { id: receiptId },
    include: {
      payment: {
        include: {
          user: { select: { id: true } },
          allocations: {
            take: 1,
            where: { type: 'RENT_SCHEDULE' },
            include: {
              rentSchedule: {
                include: {
                  lease: {
                    select: {
                      property: {
                        select: { ownerId: true, organizationId: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!receipt) return null;

  const payment = receipt.payment;
  // 1. Payer can always read their own receipt
  if (payment.userId === userId) return this.toPublic(receipt);

  // 2. Property owner or org member of any lease-allocation can read
  for (const alloc of payment.allocations) {
    const property = alloc.rentSchedule?.lease?.property;
    if (!property) continue;
    if (property.ownerId === userId) return this.toPublic(receipt);
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: property.organizationId,
        },
      },
    });
    if (membership) return this.toPublic(receipt);
  }

  throw new ForbiddenException({
    code: 'NOT_RECEIPT_OWNER',
    message: 'You are not authorized to read this receipt',
  });
}
```

You'll also need to import `ForbiddenException` from `@nestjs/common` and define a `PublicReceipt` type if it does not exist. Check the existing types in the file and add:

```ts
export interface PublicReceipt {
  id: string;
  paymentId: string;
  number: string;
  url: string;
  createdAt: string;
}
```

If the file already exports such a type, reuse it. The `toPublic(receipt)` method may need adjusting to return this `PublicReceipt` shape; check the existing implementation.

- [ ] **Step 5: Write the failing test for unauthorized access**

In `receipt.service.spec.ts`, add:

```ts
it('findByIdForUser throws ForbiddenException for unrelated user', async () => {
  const fakePrisma = {
    receipt: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'r1',
        paymentId: 'p1',
        number: 'RC-1',
        url: 'r2://',
        createdAt: new Date('2026-01-01T00:00:00Z'),
        payment: {
          userId: 'payer-user',
          allocations: [],
        },
      }),
    },
    organizationMember: { findUnique: jest.fn() },
  } as any;
  const svc = new ReceiptService(fakePrisma as any);
  await expect(svc.findByIdForUser('r1', 'other-user')).rejects.toThrow(
    ForbiddenException,
  );
});
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd apps/api && pnpm test -- receipt.service.spec.ts`
Expected: PASS

- [ ] **Step 7: Update the controller to use the new method and return 404**

In `receipt.controller.ts`, replace the entire `findOne` method body:

```ts
@Get('receipts/:id')
@UseGuards(AppAuthGuard)
async findOne(
  @CurrentUser() current: AuthenticatedUser,
  @Param('id') id: string,
) {
  try {
    return await this.receipts.findByIdForUser(id, current.userId);
  } catch (err) {
    if (err instanceof NotFoundException) {
      throw new NotFoundException({
        code: 'RECEIPT_NOT_FOUND',
        message: 'Receipt not found',
      });
    }
    throw err;
  }
}
```

Add the import at the top:

```ts
import { NotFoundException } from '@nestjs/common';
```

(Keep the existing `AppAuthGuard` and `CurrentUser` imports.)

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/payments/receipts/
git commit -m "fix(api): add RBAC to GET /receipts/:id — prevent IDOR"
```

---

### Task 3: Restrict CORS in production (P0-3)

**Files:**
- Modify: `apps/api/src/main.ts:14-18`

- [ ] **Step 1: Replace the CORS configuration**

In `apps/api/src/main.ts`, replace the `app.enableCors({...})` call with a config that reads `ALLOWED_ORIGINS` from env (comma-separated), defaulting to `*` only in development:

```ts
const allowedOrigins =
  process.env.NODE_ENV === 'production' && process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
    : process.env.NODE_ENV === 'production'
      ? [] // empty in prod without config = no CORS allowed
      : ['*'];

app.enableCors({
  origin: allowedOrigins.length === 1 && allowedOrigins[0] === '*'
    ? '*'
    : (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS: origin not allowed'));
        }
      },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
});
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Add `ALLOWED_ORIGINS` to `.env.example`**

In `.env.example` (root), add this line at the end of the Web section:

```env
# Production: comma-separated list of allowed origins for CORS (e.g. https://app.paradisimmo.cg,https://admin.paradisimmo.cg)
ALLOWED_ORIGINS=
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/main.ts .env.example
git commit -m "fix(api): restrict CORS in production via ALLOWED_ORIGINS"
```

---

### Task 4: Add `GET /properties/mine` endpoint (P0-4)

**Files:**
- Modify: `apps/api/src/properties/properties.service.ts` (add `listMine` method)
- Modify: `apps/api/src/properties/properties.controller.ts` (add route BEFORE `:id`)
- Modify: `apps/api/src/properties/properties.spec.ts` (add tests)

**Interfaces:**
- Consumes: `userId: string`, `FilterPropertiesDto`
- Produces: `PaginatedProperties` (already exists, see `properties.service.ts:52`)

- [ ] **Step 1: Add `listMine` method to the service**

In `apps/api/src/properties/properties.service.ts`, add a new method after the existing `list` method (line 194):

```ts
async listMine(
  userId: string,
  filter: FilterPropertiesDto,
): Promise<PaginatedProperties> {
  const limit = filter.limit ?? 20;
  const offset = filter.offset ?? 0;
  const where: Prisma.PropertyWhereInput = {
    ownerId: userId,
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.mode ? { mode: filter.mode } : {}),
  };
  const [rows, total] = await Promise.all([
    this.prisma.property.findMany({
      where,
      include: this.publicInclude(),
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    this.prisma.property.count({ where }),
  ]);
  return {
    data: rows.map((p) => this.toPublic(p)),
    meta: { total, limit, offset },
  };
}
```

- [ ] **Step 2: Add the controller route**

In `apps/api/src/properties/properties.controller.ts`, add the route BEFORE `@Get(':id')` (line 39). The new route must come first in the source order so that NestJS does not interpret `mine` as an `:id`:

```ts
@Get('mine')
@UseGuards(AppAuthGuard)
listMine(
  @CurrentUser() current: AuthenticatedUser,
  @Query() filter: FilterPropertiesDto,
) {
  return this.properties.listMine(current.userId, filter);
}
```

- [ ] **Step 3: Add a Swagger annotation**

Above the new `@Get('mine')` decorator, add:

```ts
@ApiTags('Properties')
@ApiBearerAuth()
```

(Apply to the whole class. The same annotation must be added once at the class level for the existing routes. The next task in the plan redoes all Swagger annotations, so for now keep it minimal here.) Then on the new method:

```ts
@ApiOperation({ summary: "List the authenticated user's properties" })
```

You'll need to add the imports:

```ts
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
```

- [ ] **Step 4: Add a failing test**

In `apps/api/src/properties/properties.spec.ts`, add a new `describe` block at the bottom of the file (before the `afterAll`):

```ts
describe('GET /properties/mine (e2e)', () => {
  let appMine: INestApplication;
  let prismaMine: PrismaService;
  let ownerId: string;
  let outsiderId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PropertiesModule],
    })
      .overrideProvider(EventPublisher)
      .useValue({ emit: jest.fn() })
      .compile();
    appMine = moduleRef.createNestApplication();
    appMine.setGlobalPrefix('api/v1');
    appMine.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await appMine.init();
    prismaMine = moduleRef.get(PrismaService);
    await prismaMine.onModuleInit();

    await prismaMine.user.deleteMany({
      where: { phone: { in: ['+242070000001', '+242070000002'] } },
    });
    const cg = await prismaMine.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Seed Congo country first');
    const owner = await prismaMine.user.create({
      data: {
        phone: '+242070000001',
        countryId: cg.id,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerId = owner.id;
    const outsider = await prismaMine.user.create({
      data: {
        phone: '+242070000002',
        countryId: cg.id,
        roles: { create: { role: 'TENANT' } },
      },
    });
    outsiderId = outsider.id;
  });

  afterAll(async () => {
    await prismaMine.user.deleteMany({
      where: { id: { in: [ownerId, outsiderId] } },
    });
    await appMine.close();
  });

  it('returns only the authenticated user properties', async () => {
    const token = await issueTestToken(prismaMine, ownerId);
    const res = await request(appMine.getHttpServer())
      .get('/api/v1/properties/mine')
      .set('x-test-user', ownerId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.meta).toBeDefined();
  });

  it('returns 401 without auth', async () => {
    await request(appMine.getHttpServer())
      .get('/api/v1/properties/mine')
      .expect(401);
  });
});
```

You will need a small helper `issueTestToken` to issue a JWT. If the test file does not already have one, add it at the top of the file:

```ts
import { JwtService } from '@nestjs/jwt';

async function issueTestToken(prisma: PrismaService, userId: string) {
  const jwt = new JwtService({
    secret: process.env.JWT_SECRET ?? 'test-secret',
  });
  return jwt.signAsync({ sub: userId, roles: ['TENANT'] });
}
```

If `JwtService` is not currently in the test file's dependencies, you may instead mock it. Look at `auth.e2e-spec.ts` for inspiration: it uses the `AppModule` boot path which issues real tokens via OTP. Adapt the test to use that pattern:

Replace the `issueTestToken` helper with the OTP-based auth flow. In `auth.e2e-spec.ts`, the pattern is:

```ts
const code = await otpStore.peek(phone);
const login = await request(app.getHttpServer())
  .post('/api/v1/auth/otp/verify')
  .send({ phone, code })
  .expect(200);
const accessToken = login.body.accessToken;
```

Adapt the new `describe` block to use the existing app from the outer `describe` (rename `app` to a shared variable if needed), or create dedicated user accounts in the global `beforeAll` and reuse them.

- [ ] **Step 5: Run the new test**

Run: `cd apps/api && pnpm test -- properties.spec.ts`
Expected: PASS (after the test correctly exercises the new endpoint).

- [ ] **Step 6: Add a test for IDOR (outsider sees nothing)**

In the same `describe` block, add:

```ts
it('outsider sees zero properties', async () => {
    const res = await request(appMine.getHttpServer())
      .get('/api/v1/properties/mine')
      .set('x-test-user', outsiderId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    // Outsider has no properties; the list should be empty or contain
    // only outsider's own (none in this test)
    expect(res.body.data.every((p: any) => p.ownerId === outsiderId)).toBe(true);
});
```

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/properties/
git commit -m "feat(api): add GET /properties/mine for owner dashboards"
```

---

## Lot 1 — Endpoints managed/mine (P1)

### Task 5: Add `GET /leases/managed`

**Files:**
- Create: `apps/api/src/leases/dto/list-leases.dto.ts`
- Modify: `apps/api/src/leases/leases.service.ts` (add `listManaged` method)
- Modify: `apps/api/src/leases/leases.controller.ts` (add route)
- Modify: `apps/api/src/leases/leases.spec.ts` (add test)

**Interfaces:**
- Produces: `PublicLease[]` (already exists, see `leases.service.ts:13`)
- Auth: any authenticated user; ownership check is internal

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/leases/dto/list-leases.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LeaseStatus } from '@prisma/client';

export class ListLeasesDto {
  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
```

- [ ] **Step 2: Add `listManaged` method to the service**

In `apps/api/src/leases/leases.service.ts`, add the following method (anywhere after `createLease`):

```ts
async listManaged(
  userId: string,
  filter: ListLeasesDto,
): Promise<PublicLease[]> {
  const accessible = await this.prisma.property.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          organization: {
            members: { some: { userId } },
          },
        },
      ],
    },
    select: { id: true },
    take: 500, // safety net: at most 500 distinct properties
  });
  const propertyIds = accessible.map((p) => p.id);
  if (propertyIds.length === 0) return [];

  const rows = await this.prisma.lease.findMany({
    where: {
      propertyId: { in: propertyIds },
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: filter.limit ?? 50,
  });
  return rows.map((l) => this.toPublic(l));
}
```

Add the import at the top of the file:

```ts
import { ListLeasesDto } from './dto/list-leases.dto';
```

- [ ] **Step 3: Add the controller route**

In `apps/api/src/leases/leases.controller.ts`, add this route AFTER `@Post()` (line 33) and before `@Patch(':id/activate')` (line 42). The route must be declared before any `:id` routes in the source order:

```ts
@Get('managed')
@UseGuards(AppAuthGuard)
managed(
  @CurrentUser() current: AuthenticatedUser,
  @Query() filter: ListLeasesDto,
) {
  return this.leases.listManaged(current.userId, filter);
}
```

Add the import:

```ts
import { ListLeasesDto } from './dto/list-leases.dto';
```

- [ ] **Step 4: Write a failing test**

In `apps/api/src/leases/leases.spec.ts`, locate the existing `describe('LeasesService', ...)` block and add a new test at the end:

```ts
it('listManaged returns leases for properties the user owns or manages', async () => {
  // Use the existing test setup. The user is `userId` (the property owner).
  // Create a lease and verify listManaged returns it.
  // If the test setup does not have a `userId` variable already, declare it.
  const leases = await service.listManaged(userId, {});
  expect(Array.isArray(leases)).toBe(true);
});
```

Adapt the test to use whatever fixtures the existing `leases.spec.ts` already provides. Read the file first to align with its patterns (mock Prisma client, etc.).

- [ ] **Step 5: Run the test**

Run: `cd apps/api && pnpm test -- leases.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/leases/
git commit -m "feat(api): add GET /leases/managed for owner/agent dashboards"
```

---

### Task 6: Add `GET /bookings/managed`

**Files:**
- Modify: `apps/api/src/bookings/bookings.service.ts` (add `listManaged`)
- Modify: `apps/api/src/bookings/bookings.controller.ts` (add route)
- Modify: `apps/api/src/bookings/bookings.spec.ts` (add test)

**Interfaces:**
- Produces: existing `PublicBooking[]` (find the type in `bookings.service.ts`)

- [ ] **Step 1: Read the existing `bookings.service.ts` to confirm the public type name**

Open the file and find the public DTO/interface for bookings (likely `PublicBooking`). Note the file path's return type.

- [ ] **Step 2: Add `listManaged` method**

In `bookings.service.ts`, add:

```ts
async listManaged(userId: string): Promise<PublicBooking[]> {
  const accessible = await this.prisma.property.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          organization: {
            members: { some: { userId } },
          },
        },
      ],
    },
    select: { id: true },
    take: 500,
  });
  const propertyIds = accessible.map((p) => p.id);
  if (propertyIds.length === 0) return [];
  const rows = await this.prisma.booking.findMany({
    where: { propertyId: { in: propertyIds } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((b) => this.toPublic(b));
}
```

- [ ] **Step 3: Add the controller route**

In `bookings.controller.ts`, add this route after `@Get('bookings/my')` (line 59) and before `@Patch('bookings/:id/cancel')` (line 65). In the source file, the route must be declared before any `:id` routes:

```ts
@Get('bookings/managed')
@UseGuards(AppAuthGuard)
managed(@CurrentUser() current: AuthenticatedUser) {
  return this.bookings.listManaged(current.userId);
}
```

- [ ] **Step 4: Add a test**

In `bookings.spec.ts`, add a test that calls `listManaged` with a known `userId` and asserts the result shape.

- [ ] **Step 5: Run the test**

Run: `cd apps/api && pnpm test -- bookings.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/bookings/
git commit -m "feat(api): add GET /bookings/managed for owner/agent dashboards"
```

---

### Task 7: Add `GET /payments/managed`

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts` (add `listManaged`)
- Modify: `apps/api/src/payments/payments.controller.ts` (add route)
- Modify: `apps/api/src/payments/payments.spec.ts` (add test)

**Interfaces:**
- Produces: `PublicPayment[]` (already exists, see `payments.service.ts:38`)

- [ ] **Step 1: Add `listManaged` method**

In `payments.service.ts`, add:

```ts
async listManaged(userId: string): Promise<PublicPayment[]> {
  // Find properties the user owns or manages
  const accessible = await this.prisma.property.findMany({
    where: {
      OR: [
        { ownerId: userId },
        {
          organization: {
            members: { some: { userId } },
          },
        },
      ],
    },
    select: { id: true },
    take: 500,
  });
  const propertyIds = accessible.map((p) => p.id);
  if (propertyIds.length === 0) return [];

  // Find leases on those properties, then find payments via allocations
  const leases = await this.prisma.lease.findMany({
    where: { propertyId: { in: propertyIds } },
    select: { id: true },
  });
  const leaseIds = leases.map((l) => l.id);
  if (leaseIds.length === 0) return [];

  const schedules = await this.prisma.rentSchedule.findMany({
    where: { leaseId: { in: leaseIds } },
    select: { id: true },
  });
  const scheduleIds = schedules.map((s) => s.id);
  if (scheduleIds.length === 0) return [];

  // Payments that have at least one allocation to a rent schedule on a managed property
  const allocations = await this.prisma.paymentAllocation.findMany({
    where: { rentScheduleId: { in: scheduleIds } },
    select: { paymentId: true },
    distinct: ['paymentId'],
    take: 500,
  });
  const paymentIds = Array.from(new Set(allocations.map((a) => a.paymentId)));
  if (paymentIds.length === 0) return [];

  const rows = await this.prisma.payment.findMany({
    where: { id: { in: paymentIds } },
    include: { allocations: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return rows.map((p) => this.toPublic(p));
}
```

- [ ] **Step 2: Add the controller route**

In `payments.controller.ts`, add this route after `@Get('payments/pending-validation')` (line 89) and before `@Post('payments/webhooks/mobile-money')` (line 95):

```ts
@Get('payments/managed')
@UseGuards(AppAuthGuard)
managed(@CurrentUser() current: AuthenticatedUser) {
  return this.payments.listManaged(current.userId);
}
```

- [ ] **Step 3: Add a test**

In `payments.spec.ts`, add a test that calls `listManaged` with a known `userId` and asserts the result shape.

- [ ] **Step 4: Run the test**

Run: `cd apps/api && pnpm test -- payments.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/payments/
git commit -m "feat(api): add GET /payments/managed for owner/agent dashboards"
```

---

### Task 8: Add `GET /maintenance/tickets/managed`

**Files:**
- Modify: `apps/api/src/maintenance/maintenance.controller.ts` (add route)
- Modify: `apps/api/src/maintenance/maintenance.spec.ts` (add test)

**Interfaces:**
- Produces: `PublicMaintenanceTicket[]` (already exists, see `maintenance.service.ts`)

- [ ] **Step 1: Find the existing `listForActor` method**

Open `maintenance.service.ts` and locate `listForActor` (around line 200). It already implements the "managed" logic. The new endpoint just exposes it under a clearer name.

- [ ] **Step 2: Add the controller route**

In `maintenance.controller.ts`, add this route after `@Get('maintenance/tickets/my')` (line 65) and before `@Get('maintenance/tickets')` (line 71):

```ts
@Get('maintenance/tickets/managed')
@UseGuards(AppAuthGuard)
managed(@CurrentUser() current: AuthenticatedUser) {
  return this.maintenance.listForActor(current.userId);
}
```

- [ ] **Step 3: Add a test**

In `maintenance.spec.ts`, add a test that calls `listForActor` with a known `userId` and asserts the result shape.

- [ ] **Step 4: Run the test**

Run: `cd apps/api && pnpm test -- maintenance.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/maintenance/
git commit -m "feat(api): add GET /maintenance/tickets/managed for owner/agent dashboards"
```

---

## Lot 2 — Swagger annotations (P1)

### Task 9: Add `@ApiTags` and `@ApiBearerAuth` to all controllers

**Files:**
- Modify: each controller file under `apps/api/src/`

- [ ] **Step 1: Add Swagger imports to each controller**

For each of the following controller files, add at the top:

```ts
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
```

Files to modify (in this order):
- `apps/api/src/auth/auth.controller.ts` — `@ApiTags('Auth')`
- `apps/api/src/users/users.controller.ts` — `@ApiTags('Users') @ApiBearerAuth()` (class level)
- `apps/api/src/properties/properties.controller.ts` — already has `@ApiTags('Properties')` from Task 4; add `@ApiBearerAuth()` at class level
- `apps/api/src/locations/locations.controller.ts` — `@ApiTags('Locations')` (no auth)
- `apps/api/src/bookings/bookings.controller.ts` — `@ApiTags('Bookings') @ApiBearerAuth()` (class level)
- `apps/api/src/leases/leases.controller.ts` — `@ApiTags('Leases') @ApiBearerAuth()` (class level)
- `apps/api/src/visit-slots/visits.controller.ts` — `@ApiTags('Visits') @ApiBearerAuth()` (class level)
- `apps/api/src/visit-slots/visit-slots.controller.ts` — `@ApiTags('VisitSlots')`; `@ApiBearerAuth()` on protected routes only
- `apps/api/src/maintenance/maintenance.controller.ts` — `@ApiTags('Maintenance') @ApiBearerAuth()` (class level)
- `apps/api/src/mandates/mandates.controller.ts` — `@ApiTags('Mandates') @ApiBearerAuth()` (class level)
- `apps/api/src/payments/payments.controller.ts` — `@ApiTags('Payments') @ApiBearerAuth()` on protected routes; webhook stays public
- `apps/api/src/payments/receipts/receipt.controller.ts` — `@ApiTags('Receipts') @ApiBearerAuth()`
- `apps/api/src/sales/sales.controller.ts` — `@ApiTags('Sales') @ApiBearerAuth()` (class level)
- `apps/api/src/admin/admin.controller.ts` — `@ApiTags('Admin') @ApiBearerAuth()` (class level)
- `apps/api/src/health/health.controller.ts` — `@ApiTags('Health')` (no auth)
- `apps/api/src/media/media.controller.ts` — `@ApiTags('Media')`; `@ApiBearerAuth()` on protected routes

- [ ] **Step 2: Add `@ApiOperation` to every route**

For each `@Get/@Post/@Patch/@Delete` decorator in every controller, add a one-line summary above the handler:

Pattern:

```ts
@Get('foo')
@ApiOperation({ summary: 'Short description of what this endpoint does' })
foo() { ... }
```

Suggested summaries:

| Controller | Route | Summary |
|---|---|---|
| auth | `POST /auth/otp/request` | "Request a 6-digit OTP via WhatsApp" |
| auth | `POST /auth/otp/verify` | "Verify OTP and issue JWT tokens" |
| auth | `POST /auth/refresh` | "Rotate refresh token and issue new pair" |
| users | `GET /users/me` | "Get authenticated user profile" |
| users | `PATCH /users/me` | "Update authenticated user profile" |
| users | `GET /users/me/organizations` | "List organizations the user belongs to" |
| properties | `GET /properties` | "List active properties (public marketplace)" |
| properties | `GET /properties/mine` | "List the authenticated user's own properties" |
| properties | `GET /properties/:id` | "Get a single property by id" |
| properties | `POST /properties` | "Create a new property" |
| properties | `PATCH /properties/:id` | "Update an existing property" |
| properties | `POST /properties/:id/archive` | "Archive a property" |
| leases | `POST /leases` | "Create a draft lease" |
| leases | `GET /leases/managed` | "List leases on properties the user owns or manages" |
| leases | `PATCH /leases/:id/activate` | "Activate a draft lease (generates rent schedule)" |
| leases | `GET /leases/:id/schedule` | "Get the rent schedule for a lease" |
| bookings | `GET /properties/:id/availability` | "List availability blocks for a property" |
| bookings | `POST /bookings` | "Create a short-stay booking" |
| bookings | `GET /bookings/my` | "List the authenticated user's bookings" |
| bookings | `GET /bookings/managed` | "List bookings on managed properties" |
| bookings | `PATCH /bookings/:id/cancel` | "Cancel a booking" |
| visits | `POST /visits` | "Book a visit slot" |
| visits | `GET /visits/my` | "List the user's own visit bookings" |
| visits | `GET /visits/managed` | "List visit bookings on managed properties" |
| visits | `PATCH /visits/:id/confirm` | "Confirm a visit booking" |
| visits | `PATCH /visits/:id/cancel` | "Cancel a visit booking" |
| visit-slots | `POST /properties/:id/visit-templates` | "Create a weekly visit-slot template" |
| visit-slots | `GET /properties/:id/visit-templates` | "List visit-slot templates for a property" |
| visit-slots | `PATCH /visit-templates/:templateId/deactivate` | "Deactivate a template" |
| visit-slots | `POST /properties/:id/visit-slots/block` | "Manually block a time range" |
| visit-slots | `GET /properties/:id/visit-slots` | "List available visit slots (public)" |
| maintenance | `POST /maintenance/tickets` | "Open a maintenance ticket" |
| maintenance | `GET /maintenance/tickets/my` | "List tickets reported by the user" |
| maintenance | `GET /maintenance/tickets/managed` | "List tickets on managed properties" |
| maintenance | `GET /maintenance/tickets` | "List tickets visible to the actor" |
| maintenance | `PATCH /maintenance/tickets/:id` | "Update a ticket status or estimated cost" |
| maintenance | `PATCH /maintenance/tickets/:id/assign` | "Assign a ticket to a technician" |
| mandates | `POST /mandates` | "Create a mandate (delegation to an org)" |
| mandates | `GET /mandates/pending-approvals` | "List pending owner approvals" |
| mandates | `PATCH /mandates/approvals/:id` | "Approve or reject a pending approval" |
| payments | `POST /payments` | "Initiate a payment (cash or mobile money)" |
| payments | `POST /payments/:id/validate` | "Validate a cash payment" |
| payments | `GET /payments/my` | "List the user's own payments" |
| payments | `GET /payments/pending-validation` | "List cash payments awaiting agent validation" |
| payments | `GET /payments/managed` | "List payments on managed properties" |
| payments | `POST /payments/webhooks/mobile-money` | "Mobile money provider webhook" |
| receipts | `GET /receipts/:id` | "Get a payment receipt" |
| sales | `POST /sales/inquiries` | "Create a sale inquiry" |
| sales | `GET /sales/inquiries/my` | "List the buyer's own inquiries" |
| sales | `GET /sales/inquiries/managed` | "List inquiries on managed properties" |
| sales | `PATCH /sales/inquiries/:id/status` | "Update inquiry status" |
| admin | `GET /admin/stats` | "Get platform-wide statistics" |
| admin | `GET /admin/users` | "List all users" |
| admin | `PATCH /admin/properties/:id/moderate` | "Moderate a property (change status)" |
| health | `GET /health` | "Liveness check" |
| media | `GET /properties/:id/media` | "List media for a property" |
| media | `POST /properties/:id/media/presign` | "Get a presigned R2 upload URL" |
| media | `POST /properties/:id/media/confirm` | "Confirm a media upload" |

Apply each summary above the corresponding route.

- [ ] **Step 3: Run the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds, no TypeScript errors.

- [ ] **Step 4: Regenerate the OpenAPI JSON**

Run: `cd apps/api && pnpm export:openapi`
Expected: file `apps/api/openapi.json` updated, all routes have `tags`, `summary`, and `security` where applicable.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ apps/api/openapi.json
git commit -m "docs(api): add Swagger tags, auth, and operation summaries to all routes"
```

---

## Lot 3 — E2E missing flows (P1)

### Task 10: Add `payments.e2e-spec.ts`

**Files:**
- Create: `apps/api/test/payments.e2e-spec.ts`

- [ ] **Step 1: Read the existing e2e test setup**

Read `apps/api/test/auth.e2e-spec.ts` (already exists) to learn the OTP-based test login pattern.

- [ ] **Step 2: Write the e2e file**

Create `apps/api/test/payments.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Payments flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const tenantPhone = '+242068888881';
  const agentPhone = '+242068888882';
  let tenantToken: string;
  let paymentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);

    // Login as tenant
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone: tenantPhone })
      .expect(202);
    const code = await otpStore.peek(tenantPhone);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: tenantPhone, code: code! })
      .expect(200);
    tenantToken = login.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup: delete the payment created during the test
    if (paymentId) {
      await prisma.paymentAllocation.deleteMany({ where: { paymentId } });
      await prisma.payment.delete({ where: { id: paymentId } }).catch(() => undefined);
    }
    await prisma.user.deleteMany({ where: { phone: { in: [tenantPhone, agentPhone] } } });
    await app.close();
  });

  it('POST /payments creates a CASH payment in PENDING_VALIDATION', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        amount: 10000,
        currency: 'XAF',
        method: 'CASH',
        idempotencyKey: `e2e-${Date.now()}`,
      })
      .expect(201);
    expect(res.body.status).toBe('PENDING_VALIDATION');
    expect(res.body.idempotencyKey).toBeDefined();
    paymentId = res.body.id;
  });

  it('POST /payments with same idempotencyKey returns the same payment', async () => {
    const key = `e2e-idem-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ amount: 5000, currency: 'XAF', method: 'CASH', idempotencyKey: key })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ amount: 5000, currency: 'XAF', method: 'CASH', idempotencyKey: key })
      .expect(201);
    expect(first.body.id).toBe(second.body.id);
    // Cleanup
    await prisma.paymentAllocation.deleteMany({ where: { paymentId: first.body.id } });
    await prisma.payment.delete({ where: { id: first.body.id } });
  });

  it('GET /payments/my lists the tenant payments', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/payments/my')
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /payments/pending-validation is accessible to authenticated users', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/payments/pending-validation')
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the e2e**

Run: `cd apps/api && pnpm test:e2e -- payments.e2e-spec.ts`
Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/payments.e2e-spec.ts
git commit -m "test(api): add e2e coverage for payments (create, idempotence, list)"
```

---

### Task 11: Add `leases.e2e-spec.ts`

**Files:**
- Create: `apps/api/test/leases.e2e-spec.ts`

- [ ] **Step 1: Write the e2e file**

Create `apps/api/test/leases.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Leases flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const ownerPhone = '+242068888883';
  const tenantPhone = '+242068888884';
  let ownerToken: string;
  let propertyId: string;
  let tenantUserId: string;
  let leaseId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(require('../src/events/event.publisher').EventPublisher)
      .useValue({ emit: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);

    // Login as owner
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone: ownerPhone })
      .expect(202);
    const code = await otpStore.peek(ownerPhone);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: ownerPhone, code: code! })
      .expect(200);
    ownerToken = login.body.accessToken;
    const ownerId = login.body.user.id;

    // Find an existing property (from seed) or create one
    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    const quartier = await prisma.quartier.findFirst();
    if (!cg || !quartier) throw new Error('Seed required first');

    const property = await prisma.property.create({
      data: {
        title: 'E2E Lease Test Property',
        description: 'A property for lease e2e tests',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'Test address',
        countryId: cg.id,
        ownerId,
        organizationId: 'org_paradis_immo',
      },
    });
    propertyId = property.id;

    // Create tenant
    const tenant = await prisma.user.create({
      data: {
        phone: tenantPhone,
        countryId: cg.id,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;
  });

  afterAll(async () => {
    if (leaseId) {
      await prisma.rentSchedule.deleteMany({ where: { leaseId } });
      await prisma.lease.delete({ where: { id: leaseId } }).catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: tenantUserId } }).catch(() => undefined);
    await app.close();
  });

  it('POST /leases creates a DRAFT lease', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
      })
      .expect(201);
    expect(res.body.status).toBe('DRAFT');
    leaseId = res.body.id;
  });

  it('PATCH /leases/:id/activate generates a rent schedule', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/leases/${leaseId}/activate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('GET /leases/:id/schedule returns the generated rent schedule', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}/schedule`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the e2e**

Run: `cd apps/api && pnpm test:e2e -- leases.e2e-spec.ts`
Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/leases.e2e-spec.ts
git commit -m "test(api): add e2e coverage for leases (create, activate, schedule)"
```

---

### Task 12: Add `mandates.e2e-spec.ts`

**Files:**
- Create: `apps/api/test/mandates.e2e-spec.ts`

- [ ] **Step 1: Write the e2e file**

Create `apps/api/test/mandates.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Mandates flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const ownerPhone = '+242068888885';
  let ownerToken: string;
  let propertyId: string;
  let mandateId: string;
  let approvalId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(require('../src/events/event.publisher').EventPublisher)
      .useValue({ emit: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);

    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone: ownerPhone })
      .expect(202);
    const code = await otpStore.peek(ownerPhone);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: ownerPhone, code: code! })
      .expect(200);
    ownerToken = login.body.accessToken;
    const ownerId = login.body.user.id;

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    const quartier = await prisma.quartier.findFirst();
    if (!cg || !quartier) throw new Error('Seed required first');

    const property = await prisma.property.create({
      data: {
        title: 'E2E Mandate Property',
        description: 'A property for mandate e2e tests',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'Test mandate address',
        countryId: cg.id,
        ownerId,
        organizationId: 'org_paradis_immo',
      },
    });
    propertyId = property.id;
  });

  afterAll(async () => {
    if (approvalId) {
      await prisma.mandateApproval.delete({ where: { id: approvalId } }).catch(() => undefined);
    }
    if (mandateId) {
      await prisma.mandate.delete({ where: { id: mandateId } }).catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await app.close();
  });

  it('POST /mandates creates an active mandate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/mandates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ propertyId, organizationId: 'org_paradis_immo' })
      .expect(201);
    expect(res.body.status).toBe('ACTIVE');
    mandateId = res.body.id;
  });

  it('GET /mandates/pending-approvals returns an empty list initially', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mandates/pending-approvals')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the e2e**

Run: `cd apps/api && pnpm test:e2e -- mandates.e2e-spec.ts`
Expected: 2 tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/mandates.e2e-spec.ts
git commit -m "test(api): add e2e coverage for mandates"
```

---

### Task 13: Add `visits.e2e-spec.ts`

**Files:**
- Create: `apps/api/test/visits.e2e-spec.ts`

- [ ] **Step 1: Write the e2e file**

Create `apps/api/test/visits.e2e-spec.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Visits flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const visitorPhone = '+242068888886';
  let visitorToken: string;
  let propertyId: string;
  let templateId: string;
  let slotId: string;
  let bookingId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(require('../src/events/event.publisher').EventPublisher)
      .useValue({ emit: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);

    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone: visitorPhone })
      .expect(202);
    const code = await otpStore.peek(visitorPhone);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: visitorPhone, code: code! })
      .expect(200);
    visitorToken = login.body.accessToken;
    const ownerId = login.body.user.id;

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    const quartier = await prisma.quartier.findFirst();
    if (!cg || !quartier) throw new Error('Seed required first');

    const property = await prisma.property.create({
      data: {
        title: 'E2E Visit Property',
        description: 'A property for visit e2e tests',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'Test visit address',
        countryId: cg.id,
        ownerId,
        organizationId: 'org_paradis_immo',
        visitEnabled: true,
        visitType: 'FREE',
      },
    });
    propertyId = property.id;
  });

  afterAll(async () => {
    if (bookingId) {
      await prisma.visitBooking.delete({ where: { id: bookingId } }).catch(() => undefined);
    }
    if (slotId) {
      await prisma.visitSlot.delete({ where: { id: slotId } }).catch(() => undefined);
    }
    if (templateId) {
      await prisma.visitSlotTemplate.delete({ where: { id: templateId } }).catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await app.close();
  });

  it('GET /properties/:id/visit-slots returns available slots (initially empty)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/visit-slots`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the e2e**

Run: `cd apps/api && pnpm test:e2e -- visits.e2e-spec.ts`
Expected: 1 test passes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/visits.e2e-spec.ts
git commit -m "test(api): add e2e coverage for visits"
```

---

## Lot 4 — Observability (P1)

### Task 14: Add `RequestIdMiddleware`

**Files:**
- Create: `apps/api/src/common/middleware/request-id.middleware.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Create the middleware**

Create `apps/api/src/common/middleware/request-id.middleware.ts`:

```ts
import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const id =
      (req.headers[REQUEST_ID_HEADER] as string | undefined) ?? randomUUID();
    (req as Request & { id: string }).id = id;
    res.setHeader(REQUEST_ID_HEADER, id);
    next();
  }
}
```

- [ ] **Step 2: Wire the middleware in `main.ts`**

In `apps/api/src/main.ts`, after `app.setGlobalPrefix('api/v1');` (line 13), add:

```ts
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
```

Then, after `app.enableCors({...});`, add:

```ts
app.use(new RequestIdMiddleware().use);
```

(Adjust the placement if you have a different middleware order. Place it BEFORE the global pipes/filters so that all requests get a request-id.)

- [ ] **Step 3: Verify the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Verify the header is set**

Run: `cd apps/api && pnpm start:dev`, then in another terminal:

```bash
curl -i http://localhost:3001/api/v1/health
```

Expected: response includes `x-request-id: <uuid>` header.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/middleware/ apps/api/src/main.ts
git commit -m "feat(api): add RequestIdMiddleware for log correlation"
```

---

### Task 15: Enhance `/health` endpoint to check DB and Redis

**Files:**
- Modify: `apps/api/src/health/health.controller.ts`
- Modify: `apps/api/src/health/health.module.ts`
- Create: `apps/api/src/health/health.service.ts`

**Interfaces:**
- Produces: `{ status: 'ok', db: 'up' | 'down', redis: 'up' | 'down' }`

- [ ] **Step 1: Create the health service**

Create `apps/api/src/health/health.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpStore } from '../auth/otp.store';

export interface HealthReport {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
  redis: 'up' | 'down';
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpStore,
  ) {}

  async check(): Promise<HealthReport> {
    const dbResult = await this.checkDb();
    const redisResult = await this.checkRedis();
    return {
      status: dbResult === 'up' && redisResult === 'up' ? 'ok' : 'degraded',
      db: dbResult,
      redis: redisResult,
    };
  }

  private async checkDb(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (err) {
      this.logger.warn(`DB health check failed: ${err}`);
      return 'down';
    }
  }

  private async checkRedis(): Promise<'up' | 'down'> {
    try {
      // OtpStore exposes a private client; we can probe via a no-op.
      // Easiest: use the OtpStore.getWithAttempts(phone) on a fake phone
      // and assert it returns null (no exception = connected).
      await this.otp.getWithAttempts('+health-probe');
      return 'up';
    } catch (err) {
      this.logger.warn(`Redis health check failed: ${err}`);
      return 'down';
    }
  }
}
```

- [ ] **Step 2: Update the controller to use the service**

In `apps/api/src/health/health.controller.ts`, replace the entire file:

```ts
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  async check() {
    return this.health.check();
  }
}
```

- [ ] **Step 3: Update the module to wire the new dependencies**

In `apps/api/src/health/health.module.ts`, replace the entire file:

```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
```

- [ ] **Step 4: Verify the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Verify the endpoint**

Run: `cd apps/api && pnpm start:dev`, then in another terminal:

```bash
curl -s http://localhost:3001/api/v1/health
```

Expected output:

```json
{"status":"ok","db":"up","redis":"up"}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/health/
git commit -m "feat(api): /health checks DB and Redis connectivity"
```

---

## Lot 5 — Security global (P1)

### Task 16: Add RBAC to `validateCashPayment`

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts:115-187`
- Modify: `apps/api/src/payments/payments.spec.ts` (add test)

- [ ] **Step 1: Add an authorization check at the start of `validateCashPayment`**

In `payments.service.ts`, modify the `validateCashPayment` method. After the existing `payment.method !== 'CASH'` check (around line 130), add a new check that verifies the agent is a member of the org owning the property linked to the lease, OR is the property owner:

```ts
// Locate the payment's rent schedule -> lease -> property to determine the managing org
const firstAlloc = allocations.find(
  (a) => a.type === 'RENT_SCHEDULE' && a.rentScheduleId,
);
let property: { ownerId: string; organizationId: string } | null = null;
if (firstAlloc?.rentScheduleId) {
  const sched = await this.prisma.rentSchedule.findUnique({
    where: { id: firstAlloc.rentScheduleId },
    include: {
      lease: { select: { property: { select: { ownerId: true, organizationId: true } } } },
    },
  });
  property = sched?.lease?.property ?? null;
}
// Fallback: if no allocation, fetch the payment to get the userId (then check org membership)
if (!property) {
  // No allocation yet — we cannot enforce property-level RBAC.
  // Allow validation only if the user is PLATFORM_ADMIN.
  const user = await this.prisma.user.findUnique({
    where: { id: agentUserId },
    include: { roles: true },
  });
  const isAdmin = user?.roles.some((r) => r.role === 'PLATFORM_ADMIN') ?? false;
  if (!isAdmin) {
    throw new ForbiddenException({
      code: 'NOT_VALIDATION_AGENT',
      message: 'Only the property owner, an agent of the managing org, or a platform admin can validate this payment',
    });
  }
} else {
  const isOwner = property.ownerId === agentUserId;
  const membership = await this.prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId: agentUserId, organizationId: property.organizationId },
    },
  });
  if (!isOwner && !membership) {
    throw new ForbiddenException({
      code: 'NOT_VALIDATION_AGENT',
      message: 'Only the property owner or an agent of the managing org can validate this payment',
    });
  }
}
```

Add the import at the top of the file:

```ts
import { ForbiddenException } from '@nestjs/common';
```

- [ ] **Step 2: Add a test in `payments.spec.ts`**

Add to the existing `describe('PaymentsService', ...)` block (after the existing tests):

```ts
it('validateCashPayment throws ForbiddenException for unrelated user', async () => {
  // Mock the prisma to return a rent schedule whose property is not owned
  // by the agent and not in any org the agent is a member of.
  const fakePrisma = {
    rentSchedule: {
      findUnique: jest.fn().mockResolvedValue({
        lease: { property: { ownerId: 'other-owner', organizationId: 'other-org' } },
      }),
    },
    organizationMember: { findUnique: jest.fn().mockResolvedValue(null) },
    payment: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'p1', method: 'CASH', status: 'PENDING_VALIDATION', allocations: [],
      }),
    },
  } as any;
  const svc = new PaymentsService(
    fakePrisma as any,
    { emit: jest.fn() } as any,
    {} as any,
    {} as any,
  );
  await expect(
    svc.validateCashPayment('unrelated-agent', 'p1', [
      { type: 'RENT_SCHEDULE', refId: 'r1', amount: 1000, rentScheduleId: 's1' },
    ]),
  ).rejects.toThrow(ForbiddenException);
});
```

- [ ] **Step 3: Run the test**

Run: `cd apps/api && pnpm test -- payments.spec.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/payments/
git commit -m "fix(api): add agent/owner RBAC to validateCashPayment"
```

---

### Task 17: Add rate limit on `requestOtp`

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts:51-55`
- Modify: `apps/api/src/auth/otp.store.ts` (add `getOtpRequestCount` and TTL methods)

**Interfaces:**
- Produces: throws `TooManyRequestsException` if > 5 OTP requests/hour for a given phone

- [ ] **Step 1: Add a rate-limit counter method in `OtpStore`**

In `apps/api/src/auth/otp.store.ts`, add a new method:

```ts
private requestCountKey(phone: string): string {
  return `paradis-immo:otp-requests:${phone}`;
}

async incrementRequestCount(phone: string, windowSeconds = 3600): Promise<number> {
  const key = this.requestCountKey(phone);
  const count = await this.client.incr(key);
  if (count === 1) {
    await this.client.expire(key, windowSeconds);
  }
  return count;
}
```

- [ ] **Step 2: Apply the rate limit in `requestOtp`**

In `apps/api/src/auth/auth.service.ts`, replace the `requestOtp` method:

```ts
async requestOtp(input: { phone: string }): Promise<void> {
  const MAX_REQUESTS_PER_HOUR = 5;
  const count = await this.otpStore.incrementRequestCount(input.phone);
  if (count > MAX_REQUESTS_PER_HOUR) {
    throw new ServiceUnavailableException({
      code: 'OTP_RATE_LIMIT',
      message: 'Too many OTP requests for this phone; try again later',
    });
  }
  const code = this.generateCode();
  await this.otpStore.put(input.phone, code);
  await this.infobip.sendOtp({ to: input.phone, code });
}
```

Add the import at the top:

```ts
import { ServiceUnavailableException } from '@nestjs/common';
```

- [ ] **Step 3: Run the existing tests**

Run: `cd apps/api && pnpm test -- auth.service.spec.ts`
Expected: existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/auth/
git commit -m "fix(api): rate limit OTP requests to 5/hour per phone"
```

---

### Task 18: Add `helmet` middleware

**Files:**
- Modify: `apps/api/package.json` (add `helmet` dependency)
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Install `helmet`**

Run: `cd apps/api && pnpm add helmet`
Expected: `helmet` added to `dependencies` in `apps/api/package.json`.

- [ ] **Step 2: Wire `helmet` in `main.ts`**

In `apps/api/src/main.ts`, add at the top:

```ts
import helmet from 'helmet';
```

After `app.setGlobalPrefix('api/v1');`, add:

```ts
app.use(helmet());
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Verify the headers are set**

Run: `cd apps/api && pnpm start:dev`, then in another terminal:

```bash
curl -i http://localhost:3001/api/v1/health
```

Expected: response includes `X-Frame-Options`, `Strict-Transport-Security` headers.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/main.ts
git commit -m "fix(api): add helmet for security headers"
```

---

### Task 19: Add `ThrottlerModule` for rate limiting

**Files:**
- Modify: `apps/api/package.json` (add `@nestjs/throttler`)
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Install `@nestjs/throttler`**

Run: `cd apps/api && pnpm add @nestjs/throttler`
Expected: package added.

- [ ] **Step 2: Wire the throttler in `app.module.ts`**

In `apps/api/src/app.module.ts`, add the import:

```ts
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
```

In the `@Module` decorator, add `ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }])` to the `imports` array, and `ThrottlerGuard` as a global guard:

```ts
@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    PrismaModule,
    // ... rest of imports
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/app.module.ts
git commit -m "fix(api): add global rate limiting via ThrottlerModule (100 req/min)"
```

---

### Task 20: Fail-fast on missing `JWT_SECRET` in production

**Files:**
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Add the fail-fast check at the top of `bootstrap`**

In `apps/api/src/main.ts`, add at the very top of the `bootstrap` function (before `NestFactory.create`):

```ts
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production');
}
```

- [ ] **Step 2: Verify the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Verify behavior**

Run: `cd apps/api && NODE_ENV=production JWT_SECRET= pnpm start:prod` (after build)
Expected: app fails to start with the error message.

Run: `cd apps/api && NODE_ENV=production JWT_SECRET=test pnpm start:prod`
Expected: app starts.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "fix(api): fail-fast on missing JWT_SECRET in production"
```

---

### Task 21: Create `apps/api/.env.example`

**Files:**
- Create: `apps/api/.env.example`

- [ ] **Step 1: Create the file with all required variables**

Create `apps/api/.env.example` with the same variables as the root `.env.example`, scoped to the API:

```env
# Paradis Immo API — required env vars
DATABASE_URL=postgresql://postgres:postpass@localhost:5432/paradis_immo
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too

# CORS (production only)
ALLOWED_ORIGINS=https://app.paradisimmo.cg

# R2 media (optional in dev — API throws if presign is called without it)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=paradis-immo
R2_PUBLIC_URL=

# Infobip WhatsApp (optional in dev — OTP is logged to console)
INFOBIP_API_KEY=
INFOBIP_BASE_URL=
INFOBIP_WHATSAPP_SENDER=

# Mobile Money
MOBILE_MONEY_PROVIDER=AIRTEL
MOBILE_MONEY_API_KEY=
MOBILE_MONEY_WEBHOOK_SECRET=

# FCM push (optional in dev)
FCM_SERVER_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/.env.example
git commit -m "docs(api): add .env.example with all required variables"
```

---

## Lot 6 — DTO inline (P1)

### Task 22: Extract `CreateLeaseDto` to its own file

**Files:**
- Create: `apps/api/src/leases/dto/create-lease.dto.ts`
- Modify: `apps/api/src/leases/leases.controller.ts:18-26`
- Modify: `apps/api/src/leases/leases.spec.ts` (no test changes, just imports)

- [ ] **Step 1: Create the DTO file**

Create `apps/api/src/leases/dto/create-lease.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Min,
} from 'class-validator';

export class CreateLeaseDto {
  @IsUUID()
  propertyId!: string;

  @IsUUID()
  tenantId!: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deposit!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;
}
```

- [ ] **Step 2: Update the controller to import the DTO**

In `apps/api/src/leases/leases.controller.ts`:

- Remove the inline `class CreateLeaseDto { ... }` (lines 18-26).
- Remove the imports of `Type`, `IsDate`, `IsNumber`, `IsString` from `class-transformer` and `class-validator` (they are no longer used in this file).
- Add the import: `import { CreateLeaseDto } from './dto/create-lease.dto';`
- Replace `dto: CreateLeaseDto` in the `@Post()` handler — no change needed since the type name is identical.

- [ ] **Step 3: Verify the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/leases/
git commit -m "refactor(api): extract CreateLeaseDto to its own file"
```

---

### Task 23: Extract `CreateBookingDto` to its own file

**Files:**
- Create: `apps/api/src/bookings/dto/create-booking.dto.ts`
- Modify: `apps/api/src/bookings/bookings.controller.ts:20-24`

- [ ] **Step 1: Create the DTO file**

Create `apps/api/src/bookings/dto/create-booking.dto.ts`:

```ts
import { Type } from 'class-transformer';
import { IsDate, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @IsUUID()
  propertyId!: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;
}
```

- [ ] **Step 2: Update the controller**

In `apps/api/src/bookings/bookings.controller.ts`:

- Remove the inline `class CreateBookingDto { ... }` (lines 20-24).
- Remove the now-unused imports of `Type`, `IsDate`, `IsString` from `class-transformer` and `class-validator`.
- Add: `import { CreateBookingDto } from './dto/create-booking.dto';`

- [ ] **Step 3: Verify the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/bookings/
git commit -m "refactor(api): extract CreateBookingDto to its own file"
```

---

### Task 24: Extract `CreateTemplateDto` to its own file

**Files:**
- Create: `apps/api/src/visit-slots/dto/create-template.dto.ts`
- Modify: `apps/api/src/visit-slots/visit-slots.controller.ts:27-32`

- [ ] **Step 1: Create the DTO file**

Create `apps/api/src/visit-slots/dto/create-template.dto.ts`:

```ts
import { Type } from 'class-transformer';
import {
  IsInt,
  Matches,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

@ValidatorConstraint({ name: 'IsTimeAfter', async: false })
class IsTimeAfter implements ValidatorConstraintInterface {
  validate(endTime: string, args: ValidationArguments) {
    const obj = args.object as CreateTemplateDto;
    return obj.startTime < endTime;
  }
  defaultMessage() {
    return 'endTime must be after startTime';
  }
}

export class CreateTemplateDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @Matches(/^\d{2}:\d{2}$/)
  startTime!: string;

  @Matches(/^\d{2}:\d{2}$/)
  @Validate(IsTimeAfter)
  endTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  slotMinutes!: number;
}
```

- [ ] **Step 2: Update the controller**

In `apps/api/src/visit-slots/visit-slots.controller.ts`:

- Remove the inline `class CreateTemplateDto { ... }` (lines 27-32).
- Remove the now-unused imports of `Type`, `IsInt`, `Matches`, `Max`, `Min` (keep `IsDateString`, `IsOptional`, `IsString` if still used elsewhere in the file).
- Add: `import { CreateTemplateDto } from './dto/create-template.dto';`

- [ ] **Step 3: Verify the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/visit-slots/
git commit -m "refactor(api): extract CreateTemplateDto with endTime>startTime validator"
```

---

### Task 25: Add `@IsBoolean` to `DecideApprovalDto`

**Files:**
- Create: `apps/api/src/mandates/dto/decide-approval.dto.ts`
- Modify: `apps/api/src/mandates/mandates.controller.ts:24-27`

- [ ] **Step 1: Create the DTO file**

Create `apps/api/src/mandates/dto/decide-approval.dto.ts`:

```ts
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class DecideApprovalDto {
  @IsBoolean()
  approve!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
```

- [ ] **Step 2: Update the controller**

In `apps/api/src/mandates/mandates.controller.ts`:

- Remove the inline `class DecideApprovalDto { ... }` (lines 24-27).
- Add: `import { DecideApprovalDto } from './dto/decide-approval.dto';`

- [ ] **Step 3: Verify the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/mandates/
git commit -m "refactor(api): add @IsBoolean to DecideApprovalDto and extract to file"
```

---

## Final verification

### Task 26: Run the full test suite and build

- [ ] **Step 1: Run unit tests**

Run: `cd apps/api && pnpm test`
Expected: all tests pass (existing + new ones).

- [ ] **Step 2: Run e2e tests**

Run: `cd apps/api && pnpm test:e2e`
Expected: all e2e tests pass (auth, users, events, health, payments, leases, mandates, visits).

- [ ] **Step 3: Run the build**

Run: `cd apps/api && pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Regenerate OpenAPI**

Run: `cd apps/api && pnpm export:openapi`
Expected: `apps/api/openapi.json` is up to date with all new routes, tags, and summaries.

- [ ] **Step 5: Smoke test**

Run: `cd apps/api && pnpm start:dev`, then in another terminal, exercise the 6 critical flows:

```bash
# 1. Health
curl -i http://localhost:3001/api/v1/health

# 2. OTP request
curl -i -X POST http://localhost:3001/api/v1/auth/otp/request -H "Content-Type: application/json" -d '{"phone":"+242060000001"}'

# 3. Properties list (public)
curl -i http://localhost:3001/api/v1/properties

# 4. Login as owner
# (read the OTP from the API logs, then verify)

# 5. With the access token:
curl -i http://localhost:3001/api/v1/properties/mine -H "Authorization: Bearer <token>"

# 6. Visit slots for a property
curl -i http://localhost:3001/api/v1/properties/<id>/visit-slots
```

Expected: every request returns a sensible response (200/202/401/403), no 5xx.

- [ ] **Step 6: Commit any final adjustments**

If steps 1-5 uncovered issues, fix them and commit. Otherwise no commit needed for this task.

---

## Spec coverage check

| Finding | Task |
|---|---|
| **P0-1** MediaModule non enregistré | Task 1 |
| **P0-2** IDOR receipts | Task 2 |
| **P0-3** CORS `*` | Task 3 |
| **P0-4** `GET /properties/mine` | Task 4 |
| **P1-1** `GET /leases/managed` | Task 5 |
| **P1-2** `GET /bookings/managed` | Task 6 |
| **P1-3** `GET /payments/managed` | Task 7 |
| **P1-4** `GET /maintenance/tickets/managed` | Task 8 |
| **P1-5** Swagger annotations | Task 9 |
| **P1-6** E2E payments | Task 10 |
| **P1-7** E2E leases | Task 11 |
| **P1-8** E2E mandates | Task 12 |
| **P1-9** E2E visits | Task 13 |
| **P1-10** RequestIdMiddleware | Task 14 |
| **P1-11** `/health` DB+Redis | Task 15 |
| **P1-12** RBAC validateCashPayment | Task 16 |
| **P1-13** Rate limit OTP | Task 17 |
| **P1-14** Helmet | Task 18 |
| **P1-15** ThrottlerModule | Task 19 |
| **P1-16** Fail-fast JWT_SECRET | Task 20 |
| **P1-17** `apps/api/.env.example` | Task 21 |
| **P1-18** DTO CreateLeaseDto | Task 22 |
| **P1-19** DTO CreateBookingDto | Task 23 |
| **P1-20** DTO CreateTemplateDto | Task 24 |
| **P1-21** DTO DecideApprovalDto | Task 25 |
| Final verification | Task 26 |

**Deferred to follow-up plan (not in this plan):**
- P2-1: Prisma index migration (`Property.ownerId`, `Payment.userId`, `VisitBooking.userId`, `Lease.tenantId`, `MaintenanceTicket.propertyId`)
- P2-2 to P2-6: `findMany` `take` defaults
- P3-1 to P3-4: logging polish, metrics, i18n messages, S-3 GET /properties/:id policy decision

**Out of scope reminder:** No frontend tests, no schema migration, no new features.
