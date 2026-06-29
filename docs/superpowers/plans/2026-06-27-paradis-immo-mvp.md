# Paradis Immo MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Paradis Immo MVP — a hybrid real estate platform (marketplace + property management) for Congo, with web dashboards for managers and a mobile app for tenants/buyers.

**Architecture:** Modular event-driven monolith (NestJS) with PostgreSQL/Prisma, Redis/BullMQ, Cloudflare R2. REST API `/api/v1` consumed by Next.js web (Preline + Tailwind) and Expo mobile (fetch only).

**Tech Stack:** NestJS, Prisma, PostgreSQL, Redis, BullMQ, Cloudflare R2, Infobip WhatsApp, Firebase FCM, pdfkit, Next.js (latest App Router), Expo React Native, TypeScript monorepo (pnpm workspaces).

**Spec reference:** `docs/superpowers/specs/2026-06-27-paradis-immo-design.md`

## Global Constraints

- API prefix: `/api/v1`
- File storage: Cloudflare R2 only (presigned uploads, no files through API)
- Messaging: Infobip WhatsApp only — no SMS
- Mobile: Expo + React Native, native `fetch` only — no TanStack Query, no Zustand
- Web: Next.js latest App Router, native `fetch` only, Preline + Tailwind — no Shadcn
- Property mode: exclusive — one of `RENT_SHORT`, `RENT_LONG`, `SALE` per active property
- Launch market: Congo (`CG`) only; multi-country model ready in schema
- Payments MVP: cash + agent validation + one Mobile Money provider (Airtel or MoMo)
- Agencies: Paradis Immo only at MVP; third-party agency UI deferred to v1.1
- JWT: access 15 min, refresh 30 days with rotation
- Error format: `{ code, message, details }`

---

## File Structure Map

```
paradis-immo/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── seed.ts
│   │   │   └── migrations/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/
│   │   │   │   ├── filters/http-exception.filter.ts
│   │   │   │   ├── guards/roles.guard.ts
│   │   │   │   ├── guards/org-context.guard.ts
│   │   │   │   ├── decorators/roles.decorator.ts
│   │   │   │   └── dto/pagination.dto.ts
│   │   │   ├── config/
│   │   │   │   ├── env.validation.ts
│   │   │   │   └── r2.config.ts
│   │   │   ├── events/
│   │   │   │   ├── event.types.ts
│   │   │   │   └── event.module.ts
│   │   │   ├── auth/
│   │   │   ├── users/
│   │   │   ├── organizations/
│   │   │   ├── locations/
│   │   │   ├── properties/
│   │   │   ├── visit-slots/
│   │   │   ├── bookings/
│   │   │   ├── leases/
│   │   │   ├── sales/
│   │   │   ├── mandates/
│   │   │   ├── payments/
│   │   │   │   ├── providers/payment-provider.interface.ts
│   │   │   │   ├── providers/cash.provider.ts
│   │   │   │   └── providers/mobile-money.provider.ts
│   │   │   ├── maintenance/
│   │   │   ├── notifications/
│   │   │   │   ├── infobip.service.ts
│   │   │   │   ├── fcm.service.ts
│   │   │   │   └── processors/
│   │   │   └── admin/
│   │   └── test/
│   ├── web/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── proprietaire/
│   │   │   ├── agent/
│   │   │   └── admin/
│   │   ├── components/
│   │   ├── lib/api.ts
│   │   └── lib/auth.ts
│   └── mobile/
│       ├── app/
│       │   ├── (auth)/
│       │   ├── (tabs)/
│       │   └── property/[id].tsx
│       └── lib/api.ts
├── packages/
│   └── types/
│       └── src/index.ts
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json
└── turbo.json
```

Each NestJS domain module follows: `{module}.module.ts`, `{module}.controller.ts`, `{module}.service.ts`, `dto/`, `*.spec.ts`.

---

## Phase 0 — Monorepo & Infrastructure

### Task 1: Monorepo scaffolding

**Files:**
- Create: `pnpm-workspace.yaml`, `package.json`, `turbo.json`, `.gitignore`, `.env.example`
- Create: `apps/api/package.json`, `apps/web/package.json`, `apps/mobile/package.json`, `packages/types/package.json`
- Create: `docker-compose.yml`

**Interfaces:**
- Produces: runnable `pnpm install`, `docker compose up -d` (postgres + redis)

- [x] **Step 1: Create root workspace files**

`pnpm-workspace.yaml`:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

`docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: paradis
      POSTGRES_PASSWORD: paradis
      POSTGRES_DB: paradis_immo
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
volumes:
  pgdata:
```

`.env.example`:
```env
DATABASE_URL=postgresql://paradis:paradis@localhost:5432/paradis_immo
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=paradis-immo
R2_PUBLIC_URL=
INFOBIP_API_KEY=
INFOBIP_BASE_URL=
INFOBIP_WHATSAPP_SENDER=
FCM_SERVER_KEY=
MOBILE_MONEY_PROVIDER=AIRTEL
MOBILE_MONEY_API_KEY=
MOBILE_MONEY_WEBHOOK_SECRET=
```

- [x] **Step 2: Scaffold NestJS API**

Run:
```bash
cd apps && npx @nestjs/cli new api --package-manager pnpm --skip-git
```

- [x] **Step 3: Scaffold Next.js web**

Run:
```bash
cd apps && pnpm create next-app web --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
```

- [x] **Step 4: Scaffold Expo mobile**

Run:
```bash
cd apps && pnpm create expo-app mobile --template blank-typescript
```

- [x] **Step 5: Verify infrastructure** (docker not used locally per user; pnpm install OK)

Run:
```bash
docker compose up -d
pnpm install
```
Expected: postgres and redis healthy.

- [x] **Step 6: Commit** (see duplicate below for commit hash)

```bash
git add .
git commit -m "chore: scaffold monorepo with api, web, mobile, docker"
```

- [x] **Step 6: Commit** (`0ebe4d5`)

---

### Task 2: Prisma schema — core entities

**Files:**
- Create: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/seed.ts`

**Interfaces:**
- Produces: Prisma client types for all MVP entities

- [x] **Step 1: Write schema**

`apps/api/prisma/schema.prisma` (core enums + identity + locations + property):

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum OrganizationType { PLATFORM AGENCY OWNER }
enum AffiliationStatus { PENDING APPROVED SUSPENDED }
enum OrgMemberRole { OWNER AGENT ADMIN }
enum GlobalRole { TENANT BUYER PLATFORM_ADMIN }
enum PropertyMode { RENT_SHORT RENT_LONG SALE }
enum PropertyStatus { DRAFT ACTIVE PAUSED ARCHIVED }
enum PropertyType { APARTMENT HOUSE LAND COMMERCIAL }
enum PriceUnit { NIGHT WEEK MONTH TOTAL }
enum VisitType { FREE PAID }
enum VisitSlotStatus { AVAILABLE BOOKED BLOCKED }
enum VisitSlotSource { TEMPLATE MANUAL }
enum VisitBookingStatus { PENDING CONFIRMED CANCELLED COMPLETED NO_SHOW }
enum BookingStatus { PENDING CONFIRMED CANCELLED COMPLETED }
enum LeaseStatus { DRAFT ACTIVE TERMINATED }
enum RentScheduleStatus { PENDING PAID OVERDUE PARTIAL }
enum SaleInquiryStatus { NEW CONTACTED VISIT_SCHEDULED CLOSED }
enum MandateStatus { ACTIVE REVOKED }
enum MandateActionType { LEASE_SIGN RENT_REDUCTION MAJOR_REPAIR }
enum ApprovalStatus { PENDING APPROVED REJECTED }
enum PaymentMethod { CASH MOBILE_MONEY BANK_TRANSFER }
enum PaymentProvider { AIRTEL MOMO }
enum PaymentStatus { INITIATED PENDING_VALIDATION VALIDATED FAILED DISPUTED }
enum AllocatableType { RENT_SCHEDULE BOOKING VISIT_BOOKING }
enum MaintenancePriority { LOW MEDIUM HIGH URGENT }
enum MaintenanceStatus { OPEN ASSIGNED IN_PROGRESS DONE CLOSED }
enum NotificationChannel { PUSH WHATSAPP }
enum MediaType { PHOTO VIDEO }
enum DocumentType { TITLE_DEED PLAN OTHER }
enum AvailabilityReason { BOOKING MAINTENANCE MANUAL }

model Country {
  id              String   @id @default(cuid())
  code            String   @unique
  name            String
  currency        String
  phonePrefix     String
  activeProviders String[]
  cities          City[]
  users           User[]
  organizations   Organization[]
  properties      Property[]
}

model User {
  id          String   @id @default(cuid())
  phone       String
  email       String?
  name        String?
  avatarUrl   String?
  countryId   String
  country     Country  @relation(fields: [countryId], references: [id])
  createdAt   DateTime @default(now())
  orgMembers  OrganizationMember[]
  roles       UserRole[]
  @@unique([phone, countryId])
}

model Organization {
  id                String             @id @default(cuid())
  name              String
  type              OrganizationType
  affiliationStatus AffiliationStatus?
  countryId         String
  country           Country            @relation(fields: [countryId], references: [id])
  members           OrganizationMember[]
  properties        Property[]
  mandates          Mandate[]
}

model OrganizationMember {
  id             String         @id @default(cuid())
  userId         String
  organizationId String
  role           OrgMemberRole
  user           User           @relation(fields: [userId], references: [id])
  organization   Organization   @relation(fields: [organizationId], references: [id])
  @@unique([userId, organizationId])
}

model UserRole {
  id          String     @id @default(cuid())
  userId      String
  role        GlobalRole
  contextType String?
  contextId   String?
  user        User       @relation(fields: [userId], references: [id])
}

model City {
  id              String           @id @default(cuid())
  name            String
  countryId       String
  country         Country          @relation(fields: [countryId], references: [id])
  arrondissements Arrondissement[]
}

model Arrondissement {
  id        String    @id @default(cuid())
  name      String
  number    Int?
  cityId    String
  city      City      @relation(fields: [cityId], references: [id])
  quartiers Quartier[]
}

model Quartier {
  id               String         @id @default(cuid())
  name             String
  arrondissementId String
  arrondissement   Arrondissement @relation(fields: [arrondissementId], references: [id])
  properties       Property[]
}

model Property {
  id              String         @id @default(cuid())
  ownerId         String
  organizationId  String
  organization    Organization   @relation(fields: [organizationId], references: [id])
  title           String
  description     String
  type            PropertyType
  mode            PropertyMode
  status          PropertyStatus @default(DRAFT)
  price           Decimal        @db.Decimal(12, 2)
  currency        String
  priceUnit       PriceUnit
  quartierId      String
  quartier        Quartier       @relation(fields: [quartierId], references: [id])
  address         String
  lat             Float?
  lng             Float?
  countryId       String
  country         Country        @relation(fields: [countryId], references: [id])
  visitEnabled    Boolean        @default(false)
  visitType       VisitType?
  visitPrice      Decimal?       @db.Decimal(12, 2)
  visitDuration   Int?
  media           PropertyMedia[]
  documents       PropertyDocument[]
  favorites       Favorite[]
  visitTemplates  VisitSlotTemplate[]
  visitSlots      VisitSlot[]
  visitBookings   VisitBooking[]
  availability    AvailabilityBlock[]
  bookings        Booking[]
  leases          Lease[]
  saleInquiries   SaleInquiry[]
  mandates        Mandate[]
  maintenance     MaintenanceTicket[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

Continue schema with remaining models (VisitSlotTemplate, VisitSlot, VisitBooking, Booking, Lease, RentSchedule, Mandate, MandateApproval, Payment, PaymentAllocation, Receipt, MaintenanceTicket, Notification, PropertyMedia, PropertyDocument, Favorite, AvailabilityBlock, SaleInquiry, RefreshToken) — mirror spec section 4 exactly.

- [x] **Step 2: Run migration**

```bash
cd apps/api && pnpm prisma migrate dev --name init
```
Expected: migration applied, client generated.

- [x] **Step 3: Write seed for Congo locations + Paradis Immo org**

`apps/api/prisma/seed.ts` — seed `Country(CG, XAF, +242)`, cities Brazzaville + Pointe-Noire with arrondissements/quartiers, `Organization` Paradis Immo (`AGENCY`, `APPROVED`).

Run:
```bash
pnpm prisma db seed
```

- [x] **Step 4: Commit** (`b1e5908`)

```bash
git commit -am "feat(api): add prisma schema and congo location seed"
```

---

### Task 3: API foundation — config, errors, Prisma module

**Files:**
- Create: `apps/api/src/config/env.validation.ts`
- Create: `apps/api/src/common/filters/http-exception.filter.ts`
- Create: `apps/api/src/common/dto/pagination.dto.ts`
- Create: `apps/api/src/prisma/prisma.module.ts`, `apps/api/src/prisma/prisma.service.ts`
- Modify: `apps/api/src/main.ts`, `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `PrismaService`, global exception filter, Swagger at `/api/docs`, prefix `/api/v1`

- [x] **Step 1: Write failing test for health endpoint**

`apps/api/test/health.e2e-spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('GET /api/v1/health returns ok', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200).expect({ status: 'ok' });
  });
});
```

- [x] **Step 2: Run test — expect FAIL**

```bash
cd apps/api && pnpm test:e2e -- health.e2e-spec
```

- [x] **Step 3: Implement health controller + foundation**

`apps/api/src/health/health.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

`apps/api/src/common/filters/http-exception.filter.ts`:
```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException } from '@nestjs/common';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse();
    const status = exception.getStatus();
    const body = exception.getResponse();
    const message = typeof body === 'string' ? body : (body as any).message;
    res.status(status).json({ code: `HTTP_${status}`, message, details: typeof body === 'object' ? body : null });
  }
}
```

Wire in `main.ts`: global prefix `api/v1`, Swagger, exception filter.

- [x] **Step 4: Run test — expect PASS**

- [x] **Step 5: Commit** (`1b968e7`)

```bash
git commit -am "feat(api): add health check, prisma module, error filter"
```

---

### Task 4: Event bus (BullMQ)

**Files:**
- Create: `apps/api/src/events/event.types.ts`
- Create: `apps/api/src/events/event.module.ts`
- Create: `apps/api/src/events/event.publisher.ts`

**Interfaces:**
- Produces: `EventPublisher.emit(eventName, payload)` used by all domain modules

- [x] **Step 1: Define event types**
`apps/api/src/events/event.types.ts`:
```typescript
export const DOMAIN_EVENTS = {
  LEASE_CREATED: 'lease.created',
  PAYMENT_VALIDATED: 'payment.validated',
  PAYMENT_INITIATED: 'payment.initiated',
  MANDATE_ACTION_PENDING: 'mandate.action.pending',
  VISIT_BOOKING_CONFIRMED: 'visit.booking.confirmed',
  MAINTENANCE_OPENED: 'maintenance.opened',
  RENT_DUE_SOON: 'rent.due.soon',
  RENT_OVERDUE: 'rent.overdue',
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];
```

- [x] **Step 2: Implement BullMQ publisher + register queues per event**

- [x] **Step 3: Write unit test — emit adds job to queue**

- [x] **Step 4: Commit** (`4e7f173`)

```bash
git commit -am "feat(api): add bullmq event publisher"
```

---

## Phase 1 — Auth & Users

### Task 5: WhatsApp OTP auth (Infobip)

**Files:**
- Create: `apps/api/src/auth/auth.module.ts`, `auth.controller.ts`, `auth.service.ts`
- Create: `apps/api/src/auth/infobip-otp.service.ts`
- Create: `apps/api/src/auth/jwt.strategy.ts`
- Create: `apps/api/src/auth/dto/request-otp.dto.ts`, `verify-otp.dto.ts`
- Test: `apps/api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, Infobip API
- Produces: `POST /auth/otp/request`, `POST /auth/otp/verify` → `{ accessToken, refreshToken, user }`

- [x] **Step 1: Write failing test — verify OTP issues tokens**

```typescript
describe('AuthService', () => {
  it('verifyOtp returns tokens for valid code', async () => {
    const result = await service.verifyOtp({ phone: '+242061234567', code: '123456' });
    expect(result.accessToken).toBeDefined();
    expect(result.user.phone).toBe('+242061234567');
  });
});
```

- [x] **Step 2: Implement OTP storage in Redis (5 min TTL, 6-digit code)**

- [x] **Step 3: Implement Infobip WhatsApp send**

`infobip-otp.service.ts` — POST to Infobip WhatsApp API with template message containing OTP.

- [x] **Step 4: Implement JWT access (15m) + refresh (30d) with rotation stored in `RefreshToken` table**

- [x] **Step 5: On first verify — create User if not exists, assign `TENANT` role**

- [x] **Step 6: Run tests — PASS**

- [x] **Step 7: Commit** (`ac0ffa9`)

```bash
git commit -am "feat(api): whatsapp otp auth via infobip"
```

---

### Task 6: Users & Organizations module

**Files:**
- Create: `apps/api/src/users/users.controller.ts`, `users.service.ts`
- Create: `apps/api/src/organizations/organizations.service.ts`

**Interfaces:**
- Produces: `GET /users/me`, `PATCH /users/me`
- Produces: helper `OrganizationsService.getParadisImmo()` for seed org

- [x] **Step 1: Implement GET/PATCH /users/me**

- [x] **Step 2: Implement org member creation when owner publishes first property (auto-create `OWNER` org)**

- [x] **Step 3: Test — authenticated user can update name**

- [x] **Step 4: Commit**

---

### Task 7: RBAC guards

**Files:**
- Create: `apps/api/src/common/decorators/roles.decorator.ts`
- Create: `apps/api/src/common/guards/roles.guard.ts`
- Create: `apps/api/src/common/guards/org-context.guard.ts`
- Create: `apps/api/src/common/decorators/org-context.decorator.ts`

**Interfaces:**
- Produces: `@Roles('AGENT')`, `@OrganizationContext()` decorators

- [x] **Step 1: Write test — guard rejects user without required org role**

- [x] **Step 2: Implement guards reading JWT claims: `{ sub, roles, orgId? }`**

- [x] **Step 3: Commit**

---

## Phase 2 — Locations & Properties

### Task 8: Locations API

**Files:**
- Create: `apps/api/src/locations/locations.controller.ts`, `locations.service.ts`

**Interfaces:**
- Produces: `GET /locations/cities`, `/arrondissements?cityId=`, `/quartiers?arrondissementId=`

- [x] **Step 1: Test — GET cities returns Brazzaville from seed**

- [x] **Step 2: Implement read-only endpoints**

- [x] **Step 3: Commit**

---

### Task 9: Properties CRUD + marketplace filters

**Files:**
- Create: `apps/api/src/properties/properties.controller.ts`, `properties.service.ts`
- Create: `apps/api/src/properties/dto/create-property.dto.ts`, `filter-properties.dto.ts`

**Interfaces:**
- Produces: full CRUD + `GET /properties?mode=&city=&arrondissement=&quartier=&minPrice=&maxPrice=`

- [x] **Step 1: Test — create property with exclusive mode RENT_LONG**

- [x] **Step 2: Test — filter by quartier returns only matching properties**

- [x] **Step 3: Test — reject second active mode on same property (must archive first)**

- [x] **Step 4: Implement service with pagination `{ data, meta }`**

- [x] **Step 5: Enforce RBAC — only owner/agent/admin can POST/PATCH/DELETE**

- [x] **Step 6: Commit**

---

### Task 10: R2 media upload (presigned)

**Files:**
- Create: `apps/api/src/properties/r2.service.ts`
- Create: `apps/api/src/properties/media.controller.ts`

**Interfaces:**
- Produces: `POST /properties/:id/media/presign`, `POST /properties/:id/media/confirm`

- [x] **Step 1: Test — presign returns uploadUrl and fileUrl**

- [x] **Step 2: Implement S3-compatible client pointing at R2**

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

async createPresignedUpload(key: string, contentType: string) {
  const command = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType });
  const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 600 });
  return { uploadUrl, fileUrl: `${publicUrl}/${key}` };
}
```

- [x] **Step 3: confirm creates PropertyMedia row**

- [x] **Step 4: Commit**

---

## Phase 3 — Visits

### Task 11: Visit slot templates + generation job

**Files:**
- Create: `apps/api/src/visit-slots/visit-slots.module.ts`
- Create: `apps/api/src/visit-slots/visit-slots.service.ts`
- Create: `apps/api/src/visit-slots/slot-generator.processor.ts`

**Interfaces:**
- Produces: CRUD templates, weekly cron generates 14 days of VisitSlot rows

- [x] **Step 1: Test — template Mon 9-12 / 30min generates 6 slots**

- [x] **Step 2: Implement generator splitting time range by visitDuration**

- [x] **Step 3: Register BullMQ repeatable job `0 2 * * 0` (weekly Sunday 2am)**

- [x] **Step 4: Test — manual BLOCKED slot excluded from available list**

- [x] **Step 5: Commit**

---

### Task 12: Visit booking (free + paid)

**Files:**
- Create: `apps/api/src/visit-slots/visits.controller.ts`
- Modify: `apps/api/src/visit-slots/visit-slots.service.ts`

**Interfaces:**
- Consumes: Payment module (Task 16) for paid visits — stub initially
- Produces: `POST /visits`, `GET /visits/my`, `GET /visits/managed`, `PATCH /visits/:id/confirm|cancel`
- Produces: `GET /properties/:id/visit-slots?from=&to=`

- [x] **Step 1: Test — book free visit sets slot BOOKED + VisitBooking CONFIRMED**

- [x] **Step 2: Test — book paid visit sets VisitBooking PENDING until payment validated**

- [x] **Step 3: Enforce slot management rule — mandate property: only org AGENT can manage templates**

- [x] **Step 4: Emit `VISIT_BOOKING_CONFIRMED` on confirm**

- [x] **Step 5: Commit**

---

## Phase 4 — Short-term Bookings

### Task 13: Availability + bookings

**Files:**
- Create: `apps/api/src/bookings/bookings.module.ts`
- Create: `apps/api/src/bookings/bookings.service.ts`
- Create: `apps/api/src/bookings/availability.service.ts`

**Interfaces:**
- Produces: `GET /properties/:id/availability`, `POST /bookings`, `GET /bookings/my`, `PATCH /bookings/:id/cancel`

- [x] **Step 1: Test — overlapping booking rejected for RENT_SHORT property**

- [x] **Step 2: Test — confirmed booking creates AvailabilityBlock**

- [x] **Step 3: Calculate totalPrice = nights × price (priceUnit NIGHT)**

- [x] **Step 4: Only RENT_SHORT properties accept bookings**

- [x] **Step 5: Commit**

---

## Phase 5 — Leases & Rent Schedules

### Task 14: Leases + auto rent schedule

**Files:**
- Create: `apps/api/src/leases/leases.module.ts`
- Create: `apps/api/src/leases/leases.service.ts`
- Create: `apps/api/src/leases/rent-schedule.generator.ts`

**Interfaces:**
- Produces: `POST /leases`, `PATCH /leases/:id/activate`, `GET /leases/:id/schedule`
- Produces: `RentScheduleGenerator.generate(lease)` → RentSchedule[]

- [x] **Step 1: Test — activate lease generates monthly RentSchedule until endDate**

```typescript
describe('RentScheduleGenerator', () => {
  it('generates one entry per month', () => {
    const entries = generator.generate({
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-01'),
      monthlyRent: 150000,
      currency: 'XAF',
    });
    expect(entries).toHaveLength(6);
    expect(entries[0].dueDate).toEqual(new Date('2026-01-01'));
  });
});
```

- [x] **Step 2: Test — unique constraint prevents duplicate dueDate per lease**

- [x] **Step 3: Emit `LEASE_CREATED` on activation**

- [x] **Step 4: Commit**

---

## Phase 6 — Mandates

### Task 15: Mandate delegation + owner approval

**Files:**
- Create: `apps/api/src/mandates/mandates.module.ts`
- Create: `apps/api/src/mandates/mandates.service.ts`
- Create: `apps/api/src/mandates/mandate-approval.service.ts`

**Interfaces:**
- Produces: `POST /mandates`, `GET /mandates/pending-approvals`, `PATCH /mandates/approvals/:id`
- Produces: `MandateApprovalService.requireApproval(mandateId, actionType, payload)`

- [ ] **Step 1: Test — lease under mandate stays DRAFT until LEASE_SIGN approved**

- [ ] **Step 2: Test — major maintenance (requiresOwnerApproval=true) creates MandateApproval**

- [ ] **Step 3: Emit `MANDATE_ACTION_PENDING` → notification job**

- [ ] **Step 4: Commit**

---

## Phase 7 — Payments & Receipts

### Task 16: Payment provider abstraction

**Files:**
- Create: `apps/api/src/payments/providers/payment-provider.interface.ts`
- Create: `apps/api/src/payments/providers/cash.provider.ts`
- Create: `apps/api/src/payments/providers/mobile-money.provider.ts`
- Create: `apps/api/src/payments/payments.service.ts`
- Create: `apps/api/src/payments/payments.controller.ts`

**Interfaces:**
- Produces:
```typescript
interface PaymentProvider {
  initiate(params: InitiatePayment): Promise<PaymentSession>;
  handleWebhook(payload: unknown): Promise<WebhookResult>;
  getStatus(reference: string): Promise<PaymentStatus>;
}
```

- [ ] **Step 1: Test — cash payment created with PENDING_VALIDATION**

- [ ] **Step 2: Test — agent validate sets VALIDATED + creates PaymentAllocation**

- [ ] **Step 3: Test — idempotencyKey prevents duplicate Mobile Money payments**

- [ ] **Step 4: Implement Mobile Money provider (Airtel or MoMo — pick one, wrap in interface)**

- [ ] **Step 5: Implement webhook `POST /payments/webhooks/mobile-money` with signature verification**

- [ ] **Step 6: Emit `PAYMENT_VALIDATED` on validate**

- [ ] **Step 7: Commit**

---

### Task 17: Receipt PDF generation

**Files:**
- Create: `apps/api/src/payments/receipt.service.ts`
- Create: `apps/api/src/payments/processors/payment-validated.processor.ts`

**Interfaces:**
- Consumes: `PAYMENT_VALIDATED` event
- Produces: Receipt row + PDF on R2, `GET /receipts/:id/download` (signed URL)

- [ ] **Step 1: Test — validated payment triggers receipt with PDF url**

- [ ] **Step 2: Implement pdfkit receipt template (tenant, amount, date, property ref)**

- [ ] **Step 3: Upload PDF to R2, store Receipt.url**

- [ ] **Step 4: Commit**

---

## Phase 8 — Sales & Maintenance

### Task 18: Sale inquiries

**Files:**
- Create: `apps/api/src/sales/sales.controller.ts`, `sales.service.ts`

**Interfaces:**
- Produces: `POST /sales/inquiries`, `GET /sales/inquiries`, `PATCH /sales/inquiries/:id`

- [ ] **Step 1: Test — inquiry only allowed on SALE mode property**

- [ ] **Step 2: Test — manager can update status NEW → CONTACTED**

- [ ] **Step 3: Commit**

---

### Task 19: Maintenance tickets

**Files:**
- Create: `apps/api/src/maintenance/maintenance.controller.ts`, `maintenance.service.ts`

**Interfaces:**
- Produces: `POST /maintenance/tickets`, `GET /maintenance/tickets`, `PATCH /:id`, `PATCH /:id/assign`
- Consumes: `MandateApprovalService` when `requiresOwnerApproval=true`

- [ ] **Step 1: Test — URGENT ticket with estimatedCost > threshold sets requiresOwnerApproval**

- [ ] **Step 2: Emit `MAINTENANCE_OPENED`**

- [ ] **Step 3: Commit**

---

## Phase 9 — Notifications

### Task 20: Infobip WhatsApp + FCM services

**Files:**
- Create: `apps/api/src/notifications/infobip.service.ts`
- Create: `apps/api/src/notifications/fcm.service.ts`
- Create: `apps/api/src/notifications/notifications.service.ts`
- Create: `apps/api/src/notifications/processors/*.processor.ts`

**Interfaces:**
- Produces: `NotificationsService.send(userId, channel, type, payload)`

- [ ] **Step 1: Test — PAYMENT_VALIDATED processor sends WhatsApp with receipt link**

- [ ] **Step 2: Implement processors for each domain event**

- [ ] **Step 3: Commit**

---

### Task 21: Rent reminder scheduled jobs

**Files:**
- Create: `apps/api/src/notifications/processors/rent-reminder.processor.ts`

**Interfaces:**
- Produces: daily job scanning RentSchedule — sends J-7, J-3, J-1, J, J+1, J+5, J+15

- [ ] **Step 1: Test — schedule due in 7 days triggers RENT_DUE_SOON**

- [ ] **Step 2: Test — overdue 1 day marks OVERDUE + sends alert**

- [ ] **Step 3: Register BullMQ repeatable job `0 8 * * *` (daily 8am Congo time)**

- [ ] **Step 4: Commit**

---

## Phase 10 — Admin & Otp gate (web/mobile)

### Task 22: Admin module

**Files:**
- Create: `apps/api/src/admin/admin.controller.ts`, `admin.service.ts`

**Interfaces:**
- Produces: `GET /admin/users`, `GET /admin/stats`, `PATCH /admin/properties/:id/moderate`

- [ ] **Step 1: Test — non-admin gets 403**

- [ ] **Step 2: Implement stats: total properties, active leases, overdue rents count**

- [ ] **Step 3: Commit**

---

### Task 23: OpenAPI + shared types package

**Files:**
- Create: `packages/types/src/index.ts`
- Modify: `apps/api` Swagger config

**Interfaces:**
- Produces: `@paradis-immo/types` exported DTOs/enums for web + mobile

- [ ] **Step 1: Enable Swagger in NestJS, export openapi.json**

- [ ] **Step 2: Script `pnpm generate:types` using openapi-typescript → packages/types**

- [ ] **Step 3: Commit**

---

## Phase 11 — Web Dashboard (Next.js)

### Task 24: Web foundation — auth, layout, Preline

**Files:**
- Create: `apps/web/lib/api.ts`, `apps/web/lib/auth.ts`
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/layout.tsx`
- Modify: `apps/web/tailwind.config.ts` — add Preline plugin

**Interfaces:**
- Consumes: API auth endpoints
- Produces: `apiFetch(path, options)` wrapper with token refresh

- [ ] **Step 1: Install Preline + configure Tailwind**

Run: `cd apps/web && pnpm add preline && pnpm add -D @tailwindcss/forms`

- [ ] **Step 2: Implement api.ts**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}
```

- [ ] **Step 3: Build OTP login page (phone input → code input → store tokens)**

- [ ] **Step 4: Commit**

---

### Task 25: Owner dashboard pages

**Files:**
- Create: `apps/web/app/proprietaire/dashboard/page.tsx`
- Create: `apps/web/app/proprietaire/biens/page.tsx`, `biens/nouveau/page.tsx`, `biens/[id]/page.tsx`
- Create: `apps/web/app/proprietaire/biens/[id]/creneaux/page.tsx`
- Create: `apps/web/app/proprietaire/visites/page.tsx`
- Create: `apps/web/app/proprietaire/baux/page.tsx`
- Create: `apps/web/app/proprietaire/paiements/page.tsx`
- Create: `apps/web/app/proprietaire/maintenance/page.tsx`
- Create: `apps/web/app/proprietaire/mandat/page.tsx`
- Create: `apps/web/app/proprietaire/layout.tsx` — sidebar nav

- [ ] **Step 1: Property create form — mode, visit config, location cascades (city → arrondissement → quartier)**

- [ ] **Step 2: Créneaux page — manage VisitSlotTemplate + manual block/add**

- [ ] **Step 3: Mandat page — button to delegate to Paradis Immo**

- [ ] **Step 4: Pending approvals widget for mandated owners**

- [ ] **Step 5: Commit**

---

### Task 26: Agent dashboard pages

**Files:**
- Create: `apps/web/app/agent/layout.tsx`
- Create: `apps/web/app/agent/dashboard/page.tsx`
- Create: `apps/web/app/agent/portefeuille/page.tsx`
- Create: `apps/web/app/agent/visites/page.tsx`
- Create: `apps/web/app/agent/baux/page.tsx`
- Create: `apps/web/app/agent/paiements/validation/page.tsx`
- Create: `apps/web/app/agent/maintenance/page.tsx`

- [ ] **Step 1: Cash validation queue — list PENDING_VALIDATION payments with validate button**

- [ ] **Step 2: Visites — today's schedule, confirm/cancel**

- [ ] **Step 3: Lease create form — triggers mandate approval if property mandated**

- [ ] **Step 4: Commit**

---

### Task 27: Admin dashboard pages

**Files:**
- Create: `apps/web/app/admin/layout.tsx`
- Create: `apps/web/app/admin/dashboard/page.tsx`
- Create: `apps/web/app/admin/utilisateurs/page.tsx`
- Create: `apps/web/app/admin/moderation/page.tsx`

- [ ] **Step 1: Stats cards from GET /admin/stats**

- [ ] **Step 2: Property moderation — pause/archive flagged listings**

- [ ] **Step 3: Role context switcher in header for multi-role users**

- [ ] **Step 4: Commit**

---

## Phase 12 — Mobile App (Expo)

### Task 28: Mobile foundation — auth + API client

**Files:**
- Create: `apps/mobile/lib/api.ts`, `apps/mobile/lib/auth.ts`
- Create: `apps/mobile/app/(auth)/login.tsx`
- Create: `apps/mobile/app/_layout.tsx`

- [ ] **Step 1: Implement api.ts (same fetch pattern as web, AsyncStorage for tokens)**

- [ ] **Step 2: OTP login screens**

- [ ] **Step 3: Commit**

---

### Task 29: Marketplace screens

**Files:**
- Create: `apps/mobile/app/(tabs)/index.tsx` — home/marketplace
- Create: `apps/mobile/app/(tabs)/favorites.tsx`
- Create: `apps/mobile/app/property/[id].tsx`
- Create: `apps/mobile/components/LocationFilter.tsx`
- Create: `apps/mobile/components/PropertyCard.tsx`

- [ ] **Step 1: Home — fetch GET /properties with filters (city, arrondissement, quartier, mode, price range)**

- [ ] **Step 2: Cascading location picker component**

- [ ] **Step 3: Property detail — gallery, map, CTA based on mode (book / visit / inquiry)**

- [ ] **Step 4: Commit**

---

### Task 30: Visits, bookings, payments screens

**Files:**
- Create: `apps/mobile/app/property/[id]/visit.tsx`
- Create: `apps/mobile/app/property/[id]/book.tsx`
- Create: `apps/mobile/app/payment/[id].tsx`
- Create: `apps/mobile/app/(tabs)/activity.tsx` — visits, bookings, leases

- [ ] **Step 1: Visit slot picker — calendar/list from GET /properties/:id/visit-slots**

- [ ] **Step 2: Book visit — free → confirmed; paid → redirect to payment screen**

- [ ] **Step 3: Short-term booking — date range picker + availability check**

- [ ] **Step 4: Payment screen — Mobile Money initiate + cash instructions display**

- [ ] **Step 5: My leases — list with pay rent CTA linking to payment**

- [ ] **Step 6: Commit**

---

### Task 31: Favorites + push notifications

**Files:**
- Create: `apps/mobile/lib/notifications.ts`
- Modify: `apps/mobile/app.json` — FCM config

- [ ] **Step 1: Register FCM device token → store on User (add `fcmToken` field)**

- [ ] **Step 2: Favorites toggle on property detail**

- [ ] **Step 3: Handle push notification tap → deep link to relevant screen**

- [ ] **Step 4: Commit**

---

## Phase 13 — Integration & Deployment

### Task 32: Otp gate + RBAC wiring (web/mobile)

- [ ] **Step 1: Web — redirect unauthenticated users to /login**

- [ ] **Step 2: Web — route guards per role (proprietaire/agent/admin)**

- [ ] **Step 3: Mobile — auth gate on tabs**

- [ ] **Step 4: Commit**

---

### Task 33: E2E critical flows

**Files:**
- Create: `apps/api/test/flows/mandate-lease.e2e-spec.ts`
- Create: `apps/api/test/flows/paid-visit.e2e-spec.ts`
- Create: `apps/api/test/flows/booking.e2e-spec.ts`

- [ ] **Step 1: E2E — mandate lease blocked until owner approves**

- [ ] **Step 2: E2E — paid visit: book → pay → confirm → slot BOOKED**

- [ ] **Step 3: E2E — short-term booking overlap rejected**

- [ ] **Step 4: Commit**

---

### Task 34: Docker production + README

**Files:**
- Create: `apps/api/Dockerfile`
- Create: `apps/web/Dockerfile`
- Modify: `docker-compose.yml` — add api + web services
- Create: `README.md`

- [ ] **Step 1: Multi-stage Dockerfile for API**

- [ ] **Step 2: docker compose up runs full stack locally**

- [ ] **Step 3: README with setup steps, env vars, seed command**

- [ ] **Step 4: Commit**

```bash
git commit -am "chore: add docker deployment and README"
```

---

## Spec Coverage Checklist

| Spec section | Task(s) |
|---|---|
| Auth WhatsApp OTP | 5, 24, 28 |
| Location hierarchy + filters | 2, 8, 29 |
| Property CRUD exclusive mode | 9 |
| R2 media | 10 |
| Visit slots + booking | 11, 12, 25, 30 |
| Short-term bookings | 13, 30 |
| Leases + rent schedule | 14 |
| Sale inquiries | 18, 29 |
| Mandates + approval | 15, 25, 26 |
| Payments cash + Mobile Money | 16, 17, 26, 30 |
| Maintenance | 19, 25, 26 |
| Notifications WhatsApp + FCM | 20, 21, 31 |
| Admin | 22, 27 |
| Web dashboards | 24-27 |
| Mobile app | 28-31 |
| Agency model ready (v1.1) | 2 (schema), no UI task |
| Multi-country ready | 2 (Country table), 8 |

---

## Suggested Implementation Order

Execute tasks **sequentially by number**. Backend tasks 1–23 must precede frontend tasks that depend on them. Within frontend, web (24–27) and mobile (28–31) can run in parallel after Task 23.

Estimated phases:
1. **Week 1–2:** Tasks 1–7 (foundation + auth)
2. **Week 3–4:** Tasks 8–15 (properties, visits, bookings, leases, mandates)
3. **Week 5–6:** Tasks 16–23 (payments, maintenance, notifications, admin, types)
4. **Week 7–9:** Tasks 24–31 (web + mobile)
5. **Week 10:** Tasks 32–34 (integration, E2E, deploy)

---

## Manual Testing Checklist (post-MVP)

- [ ] Infobip WhatsApp OTP received on real Congolese number
- [ ] Mobile Money sandbox payment → webhook → VALIDATED
- [ ] R2 presigned upload from web + mobile
- [ ] FCM push received on device
- [ ] Owner approves mandate lease via web → lease activates
- [ ] Rent reminder WhatsApp sent on schedule (adjust cron for test)
