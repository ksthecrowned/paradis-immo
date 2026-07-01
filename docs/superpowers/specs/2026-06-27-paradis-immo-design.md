# Paradis Immo — Design Specification

**Date:** 2026-06-27  
**Status:** Draft — pending user review  
**Slug:** `paradis-immo`

---

## 1. Product Overview

Paradis Immo (Paradis Immobilier) is a hybrid real estate platform for Central Africa (Congo launch market), combining:

- **Marketplace** — property discovery, short-term bookings, visit scheduling, sale inquiries
- **Property management** — long-term leases, rent schedules, receipts
- **Payment tracking** — online Mobile Money + cash validated by agents
- **Multi-role management** — tenants/buyers, owners, Paradis Immo agents, platform admin
- **Maintenance** — repair tickets with owner approval for major works
- **Future agency network** — third-party agencies in v1.1 (model ready at MVP)

### Core business rules

1. A **Property** has exactly **one active mode** at a time: `RENT_SHORT`, `RENT_LONG`, or `SALE` (never combined).
2. An owner manages **autonomously** or delegates via **Mandate** to Paradis Immo (or a future approved agency).
3. Under mandate: Paradis Immo runs daily operations; **sensitive actions require owner approval** (leases, major repairs, rent reduction).
4. Visit slots: **autonomous owner** defines per property; **under mandate**, Paradis Immo manages slots.
5. Visits can be **free or paid**, configured at property creation.
6. Payments: **cash + agent validation** and **one Mobile Money API** (Airtel Money or MoMo) at MVP.

---

## 2. Actors

| Actor | Interface | Capabilities |
|---|---|---|
| **Tenant / Buyer** | Mobile app (Expo) | Browse marketplace, book visits, short-term bookings, pay rent, view leases |
| **Owner (autonomous)** | Web dashboard | Publish properties, manage slots, leases, payments, maintenance, delegate mandate |
| **Owner (under mandate)** | Web dashboard | View revenue, approve/reject mandate actions |
| **Paradis Immo agent** | Web dashboard | Manage mandated portfolio, validate cash, create leases, maintenance |
| **Platform admin** | Web dashboard | Global supervision, moderation, agency approval (v1.1), country config |

Users can hold multiple roles. Context switching in web header (owner space vs agent space).

---

## 3. Architecture

### 3.1 Approach: Modular event-driven monolith

Single NestJS API with domain modules communicating via internal events (BullMQ). REST API v1. Not microservices at MVP.

```
┌─────────────────────┐     ┌─────────────────────┐
│  Mobile (Expo/RN)   │     │  Web (Next.js)      │
│  Tenants / Buyers   │     │  Managers / Admin   │
└──────────┬──────────┘     └──────────┬──────────┘
           │         REST /api/v1       │
           └────────────┬───────────────┘
                        ▼
           ┌────────────────────────────┐
           │     NestJS API             │
           │  Auth, Users, Organizations│
           │  Properties, Bookings      │
           │  Leases, Sales, Mandates   │
           │  Payments, Maintenance     │
           │  Notifications, Admin      │
           └────────────┬───────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   PostgreSQL        Redis          Cloudflare R2
   (Prisma)       (BullMQ)         (media, PDFs)
                        │
                        ▼
              Mobile Money API
              Infobip WhatsApp
              Firebase FCM
```

### 3.2 NestJS modules

| Module | Responsibility |
|---|---|
| `Auth` | WhatsApp OTP via Infobip, JWT access + refresh |
| `Users` | Profiles, role assignments |
| `Organizations` | Owner solo, Paradis Immo agency, future agencies |
| `Locations` | Cities, arrondissements, quartiers |
| `Properties` | CRUD, single mode, media, visit config |
| `VisitSlots` | Templates, generated slots, bookings |
| `Bookings` | Short-term reservations, availability calendar |
| `Leases` | Long-term contracts, rent schedule generation |
| `Sales` | Sale listings, inquiries |
| `Mandates` | Delegation, owner approval workflow |
| `Payments` | Provider abstraction, cash, Mobile Money |
| `Maintenance` | Tickets, technician assignment |
| `Notifications` | WhatsApp Infobip + FCM push, scheduled jobs |
| `Admin` | Moderation, stats, agency approval (v1.1) |

### 3.3 Domain events (BullMQ)

| Event | Triggers |
|---|---|
| `LeaseCreated` | Generate monthly `RentSchedule` entries |
| `RentDueSoon` | WhatsApp + push J-7, J-3, J-1 |
| `RentOverdue` | WhatsApp + push J+1, J+5, J+15 |
| `PaymentValidated` | Generate receipt PDF → R2, notify tenant |
| `PaymentInitiated` | Mobile Money webhook handling |
| `MandateActionPending` | Notify owner for approval |
| `VisitBookingConfirmed` | Notify visitor + manager |
| `MaintenanceOpened` | Notify manager; major works → owner approval |

### 3.4 Infrastructure

| Component | Choice |
|---|---|
| Database | PostgreSQL + Prisma |
| Queue / cache | Redis + BullMQ |
| File storage | **Cloudflare R2** (presigned uploads) |
| Messaging | **Infobip WhatsApp** (OTP, rent reminders, mandate alerts). No SMS |
| Push | Firebase FCM |
| PDF receipts | pdfkit or Puppeteer → R2 |
| Deployment | Docker Compose → VPS or Railway |
| Multi-country | `Country` table ready; Congo (`CG`) only at launch |

### 3.5 Error handling

- **Payments:** idempotency keys, explicit statuses, webhook retry
- **Mandates:** sensitive actions blocked until `MandateApproval` is `APPROVED`
- **API:** uniform `{ code, message, details }` error format
- **Jobs:** dead letter queue, 3 retries with backoff

---

## 4. Data Model

### 4.1 Identity & organizations

**User**
- `id`, `phone` (unique per country), `email?`, `name`, `avatarUrl?`, `countryId`, `createdAt`

**Organization**
- `id`, `name`, `type`: `PLATFORM` | `AGENCY` | `OWNER`
- `affiliationStatus`: `PENDING` | `APPROVED` | `SUSPENDED` (for third-party agencies)
- `countryId`
- MVP: only Paradis Immo as `AGENCY` with `APPROVED`. v1.1: third-party agency onboarding.

**OrganizationMember**
- `userId`, `organizationId`, `role`: `OWNER` | `AGENT` | `ADMIN`

**UserRole** (global/contextual)
- `userId`, `role`: `TENANT` | `BUYER` | `PLATFORM_ADMIN`
- Optional `contextType`, `contextId` for org-scoped roles

### 4.2 Location hierarchy

```
Country → City → Arrondissement → Quartier → Property
```

**City** — `id`, `name`, `countryId`  
**Arrondissement** — `id`, `name`, `cityId`, `number?`  
**Quartier** — `id`, `name`, `arrondissementId`  

Seeded for Congo at MVP (Brazzaville, Pointe-Noire, etc.).

### 4.3 Property

**Property**
- `id`, `ownerId`, `organizationId` (managing org)
- `title`, `description`, `type` (`APARTMENT`, `HOUSE`, `LAND`, …)
- `quartierId`, `address`, `lat`, `lng`, `countryId`
- **Mode (exclusive):** `RENT_SHORT` | `RENT_LONG` | `SALE`
- `status`: `DRAFT` | `ACTIVE` | `PAUSED` | `ARCHIVED`
- `price`, `currency`, `priceUnit` (`NIGHT`, `WEEK`, `MONTH`, `TOTAL`)
- **Visit config:** `visitEnabled`, `visitType` (`FREE` | `PAID`), `visitPrice?`, `visitDuration` (minutes)

To change mode: archive current listing, create new one. History preserved.

**PropertyMedia** — `propertyId`, `url` (R2), `type` (`PHOTO` | `VIDEO`), `order`  
**PropertyDocument** — `propertyId`, `url` (R2), `type` (`TITLE_DEED`, `PLAN`, `OTHER`)  
**Favorite** — `userId`, `propertyId`

### 4.4 Visit slots

**VisitSlotTemplate** (recurring schedule)
- `propertyId`, `dayOfWeek` (1–7), `startTime`, `endTime`
- `slotDuration`, `maxVisitsPerSlot` (default 1)

**VisitSlot** (concrete bookable slot)
- `propertyId`, `startAt`, `endAt`
- `status`: `AVAILABLE` | `BOOKED` | `BLOCKED`
- `source`: `TEMPLATE` | `MANUAL`
- `visitBookingId?`

Weekly cron generates `VisitSlot` entries for the next 14 days from templates.

**VisitBooking**
- `visitSlotId`, `visitorId`, `propertyId`
- `status`: `PENDING` | `CONFIRMED` | `CANCELLED` | `COMPLETED` | `NO_SHOW`
- `paymentId?` (if paid visit), `notes?`

**Slot management rule:**
- Autonomous owner → defines templates per property
- Under mandate → Paradis Immo agent defines/manages slots (`assignedAgentId` on Mandate)

### 4.5 Short-term rental

**AvailabilityBlock** — `propertyId`, `startDate`, `endDate`, `reason` (`BOOKING`, `MAINTENANCE`, `MANUAL`)

**Booking**
- `propertyId`, `tenantId`, `checkIn`, `checkOut`
- `totalPrice`, `currency`
- `status`: `PENDING` | `CONFIRMED` | `CANCELLED` | `COMPLETED`
- `paymentId?`

### 4.6 Long-term rental

**Lease**
- `propertyId`, `tenantId`, `startDate`, `endDate?`
- `monthlyRent`, `currency`, `deposit`
- `status`: `DRAFT` | `ACTIVE` | `TERMINATED`
- Under mandate: stays `DRAFT` until owner approves via `MandateApproval`

**RentSchedule** (auto-generated on lease activation)
- `leaseId`, `dueDate`, `amount`, `currency`
- `status`: `PENDING` | `PAID` | `OVERDUE` | `PARTIAL`
- Unique constraint: `(leaseId, dueDate)`

### 4.7 Sales

**SaleInquiry**
- `propertyId`, `buyerId`, `message`
- `status`: `NEW` | `CONTACTED` | `VISIT_SCHEDULED` | `CLOSED`

Sale flow: visit → inquiry (no direct purchase at MVP).

### 4.8 Mandates

**Mandate**
- `propertyId`, `ownerId`, `organizationId` (Paradis Immo or future agency)
- `assignedAgentId?`
- `status`: `ACTIVE` | `REVOKED`
- `startDate`, `endDate?`

**MandateApproval**
- `mandateId`, `actionType`: `LEASE_SIGN` | `RENT_REDUCTION` | `MAJOR_REPAIR`
- `payload` (JSON), `requestedBy`
- `status`: `PENDING` | `APPROVED` | `REJECTED`
- `resolvedBy?`, `resolvedAt?`

### 4.9 Payments

**Payment**
- `payerId`, `amount`, `currency`
- `method`: `CASH` | `MOBILE_MONEY` | `BANK_TRANSFER`
- `provider?`: `AIRTEL` | `MOMO`
- `status`: `INITIATED` | `PENDING_VALIDATION` | `VALIDATED` | `FAILED` | `DISPUTED`
- `reference?`, `validatedBy?`, `validatedAt?`, `idempotencyKey` (unique)

**PaymentAllocation**
- `paymentId`, `allocatableType` (`RENT_SCHEDULE`, `BOOKING`, `VISIT_BOOKING`), `allocatableId`, `amount`

**Receipt**
- `paymentId`, `url` (R2 PDF), `issuedAt`

### 4.10 Maintenance

**MaintenanceTicket**
- `propertyId`, `reportedBy`, `title`, `description`
- `priority`: `LOW` | `MEDIUM` | `HIGH` | `URGENT`
- `status`: `OPEN` | `ASSIGNED` | `IN_PROGRESS` | `DONE` | `CLOSED`
- `assignedTo?`, `estimatedCost?`
- `requiresOwnerApproval` — true for major works → triggers `MandateApproval`

### 4.11 Notifications

**Notification**
- `userId`, `channel` (`PUSH`, `WHATSAPP`), `type`, `payload`, `status`, `sentAt?`

**Country**
- `code`, `name`, `currency`, `phonePrefix`, `activeProviders[]`

### 4.12 Key constraints

- `User.phone` unique per country
- `Payment.idempotencyKey` unique
- `RentSchedule(leaseId, dueDate)` unique
- One active mode per `Property` at a time

---

## 5. API Design (REST `/api/v1`)

### 5.1 Auth

```
POST /auth/otp/request     { phone }
POST /auth/otp/verify      { phone, code }  → { accessToken, refreshToken, user }
POST /auth/refresh
POST /auth/logout
```

Access JWT: 15 min. Refresh: 30 days with rotation.

### 5.2 Core endpoints

```
/users          GET /me, PATCH /me

/locations      GET /cities, /arrondissements?cityId=, /quartiers?arrondissementId=

/properties     GET / (marketplace filters), GET /:id, POST /, PATCH /:id, DELETE /:id
                POST /:id/media/presign, POST /:id/media/confirm
                GET /:id/availability

/visit-slots    GET /properties/:id/visit-slots?from=&to=
/visits         POST /, GET /my, GET /managed, PATCH /:id/confirm, PATCH /:id/cancel

/bookings       POST /, GET /my, PATCH /:id/cancel

/leases         POST /, GET /my, GET /managed, PATCH /:id/activate, GET /:id/schedule

/sales          POST /inquiries, GET /inquiries, PATCH /inquiries/:id

/mandates       POST /, GET /pending-approvals, PATCH /approvals/:id

/payments       POST /, POST /:id/validate, GET /my, GET /managed
                POST /webhooks/mobile-money

/receipts       GET /:id/download

/maintenance    POST /tickets, GET /tickets, PATCH /tickets/:id, PATCH /tickets/:id/assign

/notifications  GET /my, PATCH /:id/read

/admin          GET /users, GET /stats, PATCH /properties/:id/moderate
```

### 5.3 Marketplace filters

```
GET /properties?mode=RENT_LONG&city=brazzaville&arrondissement=3&quartier=poto-poto&minPrice=&maxPrice=&page=1&limit=20
```

Response: `{ data: [], meta: { total, page, limit, pages } }`

### 5.4 RBAC matrix

| Action | Tenant/Buyer | Owner | Agent | Admin |
|---|---|---|---|---|
| Browse marketplace | ✅ | ✅ | ✅ | ✅ |
| Book visit | ✅ | — | — | — |
| Short-term booking | ✅ | — | — | — |
| Publish property | — | ✅ | ✅ | ✅ |
| Create lease | — | ✅ / mandate | ✅ | ✅ |
| Validate cash payment | — | — | ✅ | ✅ |
| Approve mandate action | — | ✅ | — | — |
| Manage visit slots | — | ✅ (autonomous) | ✅ (mandated) | ✅ |
| Maintenance | — | ✅ | ✅ | ✅ |
| Moderation | — | — | — | ✅ |

### 5.5 NestJS guards

- `@Roles('AGENT', 'OWNER')`
- `@OrganizationContext()` — injects org from JWT
- `@RequiresMandate('propertyId')`
- `@OwnerApprovalRequired()`

Permission levels: global role → organization context → property ownership/mandate.

---

## 6. Frontends

### 6.1 Mobile — Expo + React Native

**Stack:** Expo, React Native, native `fetch` only (no TanStack Query, no Zustand). Shared types from `@paradis-immo/types`.

**Screens:**
- Auth (WhatsApp OTP)
- Marketplace home + filters (city, arrondissement, quartier, mode, price)
- Property detail + gallery + map
- Visit slot picker → book (free/paid)
- Short-term booking + calendar
- Payment (Mobile Money / cash instructions)
- My visits, bookings, leases, payments
- Favorites, notifications

### 6.2 Web — Next.js (latest) App Router

**Stack:** Next.js App Router, native `fetch` only, Preline + Tailwind, ApexCharts, Lucide icons. Per-app local types from OpenAPI snapshot.

**Visual design:** Darkone-inspired dark admin shell (see `docs/superpowers/specs/2026-06-29-paradis-immo-dashboard-ui-routes-design.md`). Shared `DashboardShell` (sidebar + topbar). No Bootstrap in bundle.

**Routes (English paths, French UI labels):**

```
/owner          dashboard, properties, properties/add, properties/[id]/visit-slots,
                visits, leases, payments, maintenance, mandate
/agent          dashboard, portfolio, visits, leases, payments/validation, maintenance
/admin          dashboard, users, moderation, config
/login
```

Role context switcher in topbar for multi-role users. Legacy `/proprietaire/*` redirects during migration (one release).

### 6.3 Media upload (R2)

```
POST /properties/:id/media/presign  → { uploadUrl, fileUrl }
PUT uploadUrl (direct to R2)
POST /properties/:id/media/confirm  { fileUrl }
```

---

## 7. Payments

### 7.1 Provider abstraction

```typescript
interface PaymentProvider {
  initiate(params: InitiatePayment): Promise<PaymentSession>
  handleWebhook(payload: unknown): Promise<WebhookResult>
  getStatus(reference: string): Promise<PaymentStatus>
}
```

Implementations at MVP: `CashProvider`, `MobileMoneyProvider` (one of Airtel or MoMo).

### 7.2 Flows

| Context | Cash | Mobile Money |
|---|---|---|
| Rent | Agent validates → `VALIDATED` | Webhook → `VALIDATED` |
| Short-term booking | Same | Same |
| Paid visit | Same | Same |

On `VALIDATED`: generate receipt PDF → R2 → WhatsApp notification with link.

---

## 8. Notifications

| Event | Channels | Recipient |
|---|---|---|
| OTP | WhatsApp | User |
| Visit confirmed | WhatsApp + Push | Visitor + manager |
| Rent reminder J-7/J-3/J-1 | WhatsApp + Push | Tenant |
| Rent due day J | WhatsApp + Push | Tenant |
| Overdue J+1/J+5/J+15 | WhatsApp + Push | Tenant + manager |
| Payment validated | WhatsApp + Push | Tenant |
| Receipt ready | WhatsApp (R2 link) | Tenant |
| Mandate approval needed | WhatsApp + Push | Owner |
| Mandate resolved | WhatsApp | Agent |
| Major maintenance | WhatsApp | Owner (mandate) |

Daily BullMQ job scans `RentSchedule` for due/overdue items.

---

## 9. Agency model (v1.1 ready)

- Paradis Immo = `Organization` type `AGENCY`, `affiliationStatus: APPROVED`
- Third-party agencies register → `PENDING` → admin approves → `APPROVED`
- Owner mandate selects organization (Paradis Immo or approved agency)
- No schema changes expected for v1.1 — UI admin + registration flow only

---

## 10. MVP Scope

### Included

- Auth (WhatsApp OTP, JWT)
- Location hierarchy + marketplace filters (Congo seed)
- Property CRUD, exclusive mode, R2 media
- Visit config, slot templates, booking (free/paid)
- Short-term bookings + availability
- Long-term leases + auto rent schedule
- Sale listings + inquiries
- Mandate delegation + owner approval workflow
- Payments: cash + agent validation + one Mobile Money API + receipts
- Maintenance tickets + owner approval for major works
- Notifications: WhatsApp Infobip + FCM
- Web dashboards: owner, Paradis Immo agent, admin
- Mobile app: marketplace, visits, bookings, rent payments

### v1.1 (model ready, not implemented)

- Third-party agency registration + admin approval
- Bank transfer + proof upload
- Email notifications
- Second Mobile Money provider
- Advanced analytics

### Out of scope

- GraphQL, microservices
- Multi-country activation (model ready)
- In-app chat
- Native app store builds (Expo sufficient)

---

## 11. Repository structure

```
paradis-immo/
├── apps/
│   ├── api/          # NestJS
│   ├── web/          # Next.js dashboards
│   └── mobile/       # Expo React Native
├── packages/
│   └── types/        # OpenAPI-generated shared types
├── docs/
│   └── superpowers/
│       ├── specs/
│       └── plans/
├── docker-compose.yml
└── README.md
```

---

## 12. Testing strategy (MVP)

- **API:** unit tests per module (payments, mandates, rent schedule generation), integration tests for critical flows (OTP auth, payment validation, lease → schedule)
- **E2E:** booking flow, visit booking + paid visit, mandate approval blocking lease activation
- **Manual:** Mobile Money sandbox, Infobip WhatsApp templates, R2 uploads

---

## 13. Open decisions (resolved)

| Decision | Choice |
|---|---|
| Architecture | Modular event-driven monolith (NestJS) |
| API | REST v1 |
| File storage | Cloudflare R2 |
| Messaging | Infobip WhatsApp (no SMS) |
| Mobile | Expo + React Native, fetch only |
| Web | Next.js latest, Preline + Tailwind, fetch only |
| Property modes | Exclusive (one at a time) |
| Visit slots | Hybrid templates + manual; mandate vs autonomous |
| Agencies | Platform operator + affiliated (v1.1 UI) |
| Launch market | Congo, multi-country model ready |
