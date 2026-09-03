# Preuve de paiements acheteur (BuyerPaymentProof / S4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner/agent d’un dossier vente demande l’accès aux 3 derniers paiements `PAID` (loyers + paliers) de l’acheteur ; l’acheteur accepte/refuse ; snapshot figé visible 7 jours.

**Architecture:** Nouveau modèle `BuyerPaymentProof` + service dans `SalesModule` (miroir de `SolvencyChecksService`, sans fusion). Droits = accès manager au `SaleAgreement`. Snapshot JSON mixte (`RENT` | `SALE_INSTALLMENT`) figé à l’acceptation. Expiration lazy sur `latest`. Notif via `EventPublisher` + processor.

**Tech Stack:** NestJS + Prisma, Next.js owner/agent, Expo mobile, Jest (DB réelle).

**Spec:** `docs/superpowers/specs/2026-09-03-buyer-payment-proof-design.md`

## Global Constraints

- Snapshot : `kind`, `dueDate`, `paidAt`, `amount`, `currency`, `daysLate` — **pas** de bien / titre / adresse / `saleAgreementId` source.
- Max **3** items : union `RentSchedule` PAID (`lease.tenantId = buyer`) + `SaleInstallment` PAID (`agreement.buyerId = buyer`), tri `dueDate` desc.
- Accès owner : **7 jours** après acceptation (`expiresAt`).
- Un seul `PENDING` par `saleAgreementId`.
- Dossier `CANCELLED` → 400 `AGREEMENT_CANCELLED`.
- `paidAt` : `Payment.validatedAt` du paiement `VALIDATED` alloué ; sinon fallback `updatedAt` de l’échéance PAID.
- Copy FR : « Demander la preuve de paiements », « En attente de la réponse de l’acheteur », « Expire le … », types UI `LOYER` / `PALIER`.
- Commits : seulement si l’utilisateur le demande.

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Enum + model + relations SaleAgreement / User / Organization |
| `apps/api/prisma/migrations/20260903120000_buyer_payment_proofs/migration.sql` | Migration |
| `apps/api/src/events/event.types.ts` | `BUYER_PAYMENT_PROOF_REQUESTED` + payload |
| `apps/api/src/sales/buyer-payment-proofs.service.ts` | Create / respond / latest / snapshot |
| `apps/api/src/sales/buyer-payment-proofs.controller.ts` | Routes owner + `/me` |
| `apps/api/src/sales/dto/respond-buyer-payment-proof.dto.ts` | `{ accept: boolean }` |
| `apps/api/src/sales/buyer-payment-proofs.spec.ts` | Tests service |
| `apps/api/src/sales/sales.module.ts` | Wire providers / controllers |
| `apps/api/src/notifications/processors/buyer-payment-proof.processor.ts` | Notif acheteur |
| `apps/api/src/notifications/notifications.module.ts` | Register processor |
| `apps/web/lib/owner/buyer-payment-proofs.ts` | Client API |
| `apps/web/components/sales/sale-agreement-detail.tsx` | Bloc Preuve de paiements |
| `apps/mobile/lib/buyer-payment-proofs.ts` | Client API |
| `apps/mobile/app/achats/preuves.tsx` | Liste + répondre |
| `apps/mobile/app/achats/index.tsx` | Badge / lien |
| `TODOS.md` | S4 → focus + sous-tâches ✅ |

---

### Task 1: Prisma + event type

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260903120000_buyer_payment_proofs/migration.sql`
- Modify: `apps/api/src/events/event.types.ts`

**Interfaces:**
- Produces: `BuyerPaymentProof`, `BuyerPaymentProofStatus`, `DOMAIN_EVENTS.BUYER_PAYMENT_PROOF_REQUESTED`

- [ ] **Step 1: Add enum + model** near `SaleAgreement` / after `SolvencyCheck`:

```prisma
enum BuyerPaymentProofStatus {
  PENDING
  GRANTED
  DENIED
  EXPIRED
}

model BuyerPaymentProof {
  id              String                  @id @default(uuid())
  saleAgreementId String
  saleAgreement   SaleAgreement           @relation(fields: [saleAgreementId], references: [id])
  buyerUserId     String
  buyer           User                    @relation("BuyerPaymentProofBuyer", fields: [buyerUserId], references: [id])
  requesterUserId String
  requesterOrgId  String
  organization    Organization            @relation(fields: [requesterOrgId], references: [id])
  status          BuyerPaymentProofStatus @default(PENDING)
  snapshot        Json?
  respondedAt     DateTime?
  expiresAt       DateTime?
  createdAt       DateTime                @default(now())
  updatedAt       DateTime                @updatedAt

  @@index([saleAgreementId, status])
  @@index([buyerUserId, status])
}
```

Add relations:
- `SaleAgreement.paymentProofs BuyerPaymentProof[]`
- `User.buyerPaymentProofs BuyerPaymentProof[] @relation("BuyerPaymentProofBuyer")`
- `Organization.buyerPaymentProofs BuyerPaymentProof[]`

- [ ] **Step 2: Migration SQL** — create enum, table, indexes, FKs.

```sql
-- CreateEnum
CREATE TYPE "BuyerPaymentProofStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "BuyerPaymentProof" (
    "id" TEXT NOT NULL,
    "saleAgreementId" TEXT NOT NULL,
    "buyerUserId" TEXT NOT NULL,
    "requesterUserId" TEXT NOT NULL,
    "requesterOrgId" TEXT NOT NULL,
    "status" "BuyerPaymentProofStatus" NOT NULL DEFAULT 'PENDING',
    "snapshot" JSONB,
    "respondedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BuyerPaymentProof_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BuyerPaymentProof_saleAgreementId_status_idx" ON "BuyerPaymentProof"("saleAgreementId", "status");
CREATE INDEX "BuyerPaymentProof_buyerUserId_status_idx" ON "BuyerPaymentProof"("buyerUserId", "status");

ALTER TABLE "BuyerPaymentProof" ADD CONSTRAINT "BuyerPaymentProof_saleAgreementId_fkey" FOREIGN KEY ("saleAgreementId") REFERENCES "SaleAgreement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyerPaymentProof" ADD CONSTRAINT "BuyerPaymentProof_buyerUserId_fkey" FOREIGN KEY ("buyerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BuyerPaymentProof" ADD CONSTRAINT "BuyerPaymentProof_requesterOrgId_fkey" FOREIGN KEY ("requesterOrgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 3: Extend domain events** in `event.types.ts`:

```ts
BUYER_PAYMENT_PROOF_REQUESTED: 'buyer_payment_proof.requested',
```

Extend `EventPayloadOf` branch:

```ts
: E extends typeof DOMAIN_EVENTS.BUYER_PAYMENT_PROOF_REQUESTED
  ? {
      proofId: string;
      buyerUserId: string;
      saleAgreementId: string;
      requesterOrgId: string;
      organizationName: string;
    }
```

(Keep the existing `SOLVENCY_CHECK_REQUESTED` branch; nest the new branch in the conditional chain before the final `Record<string, unknown>`.)

- [ ] **Step 4: Apply**

```bash
cd apps/api && bunx prisma migrate deploy && bunx prisma generate
```

Expected: migrate applied, client regenerated with `buyerPaymentProof`.

- [ ] **Step 5: Commit** (si demandé)

```bash
git add apps/api/prisma apps/api/src/events/event.types.ts
git commit -m "$(cat <<'EOF'
feat(api): add BuyerPaymentProof model and domain event

EOF
)"
```

---

### Task 2: Service — create + respond + latest (TDD)

**Files:**
- Create: `apps/api/src/sales/buyer-payment-proofs.service.ts`
- Create: `apps/api/src/sales/buyer-payment-proofs.spec.ts`
- Modify: `apps/api/src/sales/sales.module.ts` (providers only for now)

**Interfaces:**
- Consumes: `AgencyAccessService`, `PrismaService`, `EventPublisher`
- Produces:
  - `create(managerUserId, saleAgreementId): Promise<PublicBuyerPaymentProof>`
  - `respond(buyerUserId, proofId, accept: boolean): Promise<PublicBuyerPaymentProof>`
  - `latestForAgreement(managerUserId, saleAgreementId): Promise<PublicBuyerPaymentProof | null>`
  - `listForBuyer(buyerUserId): Promise<PublicBuyerPaymentProof[]>`

`PublicBuyerPaymentProof` shape:

```ts
{
  id: string;
  saleAgreementId: string;
  buyerUserId: string;
  requesterOrgId: string;
  organizationName: string;
  status: BuyerPaymentProofStatus;
  snapshot: BuyerPaymentProofSnapshotItem[] | null; // null unless GRANTED and not expired
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

type BuyerPaymentProofSnapshotItem = {
  kind: 'RENT' | 'SALE_INSTALLMENT';
  dueDate: string; // YYYY-MM-DD
  paidAt: string;  // ISO
  amount: string;
  currency: string;
  daysLate: number;
};
```

- [ ] **Step 1: Write failing tests** in `buyer-payment-proofs.spec.ts` (pattern like `solvency-checks.spec.ts` / `sale-agreements.spec.ts`):
  - create → PENDING + emit `BUYER_PAYMENT_PROOF_REQUESTED`
  - create with 0 PAID anywhere → 400 `NO_PAID_PAYMENTS`
  - create on `CANCELLED` agreement → 400 `AGREEMENT_CANCELLED`
  - second PENDING same agreement → 409 `PENDING_EXISTS`
  - accept → snapshot length ≤ 3, can mix kinds, `expiresAt` ~ +7d, `daysLate` correct, no property fields
  - deny → snapshot null for owner latest
  - latest after past `expiresAt` → status EXPIRED, snapshot null
  - stranger manager → 403/404 like other sale-agreement routes

Seed: owner property SALE + `SaleAgreement` ACTIVE with buyer ; give buyer ≥1 PAID `RentSchedule` and/or PAID `SaleInstallment` (can be another agreement or same) with validated payments when testing `paidAt`.

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/sales/buyer-payment-proofs.spec.ts --forceExit
```

Expected: FAIL (module/service missing or tests red).

- [ ] **Step 3: Implement `BuyerPaymentProofsService`**

```ts
const ACCESS_DAYS = 7;
const MS_PER_DAY = 86_400_000;

@Injectable()
export class BuyerPaymentProofsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly events: EventPublisher,
  ) {}

  async create(managerUserId: string, saleAgreementId: string): Promise<PublicBuyerPaymentProof> { /* ... */ }
  async respond(buyerUserId: string, proofId: string, accept: boolean): Promise<PublicBuyerPaymentProof> { /* ... */ }
  async latestForAgreement(managerUserId: string, saleAgreementId: string): Promise<PublicBuyerPaymentProof | null> { /* ... */ }
  async listForBuyer(buyerUserId: string): Promise<PublicBuyerPaymentProof[]> { /* ... */ }
}
```

Key helpers:

```ts
async loadOperableAgreement(managerUserId: string, saleAgreementId: string) {
  const agreement = await this.prisma.saleAgreement.findUnique({
    where: { id: saleAgreementId },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!agreement) throw new NotFoundException({ code: 'SALE_AGREEMENT_NOT_FOUND', message: 'Dossier introuvable' });
  await this.agencyAccess.assertCanOperateOnProperty(managerUserId, agreement.propertyId);
  return agreement;
}

async countPaidPayments(buyerUserId: string): Promise<number> {
  const [rents, installments] = await Promise.all([
    this.prisma.rentSchedule.count({
      where: { status: 'PAID', lease: { tenantId: buyerUserId } },
    }),
    this.prisma.saleInstallment.count({
      where: { status: 'PAID', agreement: { buyerId: buyerUserId } },
    }),
  ]);
  return rents + installments;
}

async buildSnapshot(buyerUserId: string): Promise<BuyerPaymentProofSnapshotItem[]> {
  // 1. Load candidate PAID rents + installments (take more than 3 each if needed, e.g. take 3 each then merge)
  // 2. For each resolve paidAt via PaymentAllocation (RENT_SCHEDULE / SALE_INSTALLMENT) → Payment.validatedAt
  //    else fallback schedule/installment.updatedAt (SaleInstallment has createdAt only — use createdAt or find payment)
  //    Prefer: look up latest VALIDATED payment allocated to refId; if none, use installment.createdAt as last resort
  // 3. Map to snapshot items with kind
  // 4. Sort by dueDate desc, take 3
  // 5. daysLate = max(0, floor((startOfDayUTC(paidAt) - startOfDayUTC(dueDate)) / MS_PER_DAY))
}

serialize(row, { includeSnapshot: boolean }): PublicBuyerPaymentProof
maybeExpire(row): Promise<row> // if GRANTED && expiresAt < now → update EXPIRED
```

`create`:
1. `loadOperableAgreement`
2. if `status === CANCELLED` → `BadRequestException` `{ code: 'AGREEMENT_CANCELLED' }`
3. `countPaidPayments(agreement.buyerId) < 1` → `{ code: 'NO_PAID_PAYMENTS' }`
4. existing PENDING for `saleAgreementId` → `ConflictException` `{ code: 'PENDING_EXISTS' }`
5. create row with `buyerUserId = agreement.buyerId`, `requesterOrgId = agreement.organizationId`
6. `events.emit(DOMAIN_EVENTS.BUYER_PAYMENT_PROOF_REQUESTED, { proofId, buyerUserId, saleAgreementId, requesterOrgId, organizationName })`
7. return serialize without snapshot

`respond`:
1. findUnique proof ; must `buyerUserId === current` else NOT_FOUND
2. must be PENDING else `PROOF_NOT_PENDING`
3. if accept: `buildSnapshot` + GRANTED + `expiresAt = now + 7d` + `respondedAt`
4. else DENIED + `respondedAt`
5. return serialize (include snapshot only if GRANTED)

`latestForAgreement`:
1. loadOperableAgreement
2. findFirst where saleAgreementId orderBy createdAt desc
3. maybeExpire
4. serialize with snapshot only if GRANTED (post-expire)

`listForBuyer`: findMany buyerUserId orderBy createdAt desc ; PENDING first in memory (same as solvency) ; no snapshot in list (or include only for own GRANTED — prefer **never** include snapshot in list, mirror solvency list).

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/api && bunx jest src/sales/buyer-payment-proofs.spec.ts --forceExit
```

- [ ] **Step 5: Commit** (si demandé)

---

### Task 3: HTTP controllers + notification processor

**Files:**
- Create: `apps/api/src/sales/dto/respond-buyer-payment-proof.dto.ts`
- Create: `apps/api/src/sales/buyer-payment-proofs.controller.ts`
- Create: `apps/api/src/notifications/processors/buyer-payment-proof.processor.ts`
- Modify: `apps/api/src/sales/sales.module.ts`
- Modify: `apps/api/src/notifications/notifications.module.ts`
- Modify: `apps/api/src/notifications/notifications.service.ts` if notification `type` is an allowlist enum — add `BUYER_PAYMENT_PROOF_REQUESTED`

**Interfaces:**
- Routes:
  - `POST /sale-agreements/:id/payment-proofs` → 201
  - `GET /sale-agreements/:id/payment-proofs/latest`
  - `GET /me/buyer-payment-proofs`
  - `POST /me/buyer-payment-proofs/:id/respond`

- [ ] **Step 1: DTO**

```ts
import { IsBoolean } from 'class-validator';

export class RespondBuyerPaymentProofDto {
  @IsBoolean()
  accept!: boolean;
}
```

- [ ] **Step 2: Controllers** (same file pattern as solvency):

```ts
@ApiTags('Buyer payment proofs')
@ApiBearerAuth()
@Controller('sale-agreements/:id/payment-proofs')
@UseGuards(AppAuthGuard)
export class SaleAgreementPaymentProofsController {
  constructor(private readonly proofs: BuyerPaymentProofsService) {}

  @Post()
  @HttpCode(201)
  create(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.proofs.create(current.userId, id);
  }

  @Get('latest')
  latest(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.proofs.latestForAgreement(current.userId, id);
  }
}

@ApiTags('Buyer payment proofs')
@ApiBearerAuth()
@Controller('me/buyer-payment-proofs')
@UseGuards(AppAuthGuard)
export class MeBuyerPaymentProofsController {
  constructor(private readonly proofs: BuyerPaymentProofsService) {}

  @Get()
  list(@CurrentUser() current: AuthenticatedUser) {
    return this.proofs.listForBuyer(current.userId);
  }

  @Post(':id/respond')
  @HttpCode(200)
  respond(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RespondBuyerPaymentProofDto,
  ) {
    return this.proofs.respond(current.userId, id, dto.accept);
  }
}
```

Register both controllers + `BuyerPaymentProofsService` in `SalesModule` (ensure `EventModule` / `EventPublisher` import like leases/tenants).

- [ ] **Step 3: Processor**

```ts
@OnEvent(DOMAIN_EVENTS.BUYER_PAYMENT_PROOF_REQUESTED)
async handle(event: DomainEvent<{
  proofId: string;
  buyerUserId: string;
  saleAgreementId: string;
  requesterOrgId: string;
  organizationName: string;
}>) {
  await this.notifications.send({
    userId: event.payload.buyerUserId,
    type: 'BUYER_PAYMENT_PROOF_REQUESTED',
    payload: {
      proofId: event.payload.proofId,
      saleAgreementId: event.payload.saleAgreementId,
      organizationName: event.payload.organizationName,
    },
  });
}
```

Register in `notifications.module.ts` providers.

- [ ] **Step 4: If `NotificationsService` validates `type`, add the new string** (grep existing `SOLVENCY_CHECK_REQUESTED` and mirror).

- [ ] **Step 5: Re-run**

```bash
cd apps/api && bunx jest src/sales/buyer-payment-proofs.spec.ts --forceExit
```

Expected: PASS.

- [ ] **Step 6: Commit** (si demandé)

---

### Task 4: Web owner — bloc Preuve sur dossier vente

**Files:**
- Create: `apps/web/lib/owner/buyer-payment-proofs.ts`
- Modify: `apps/web/components/sales/sale-agreement-detail.tsx`

**Interfaces:**
- `getLatestBuyerPaymentProof(agreementId): Promise<PublicBuyerPaymentProof | null>`
- `requestBuyerPaymentProof(agreementId): Promise<PublicBuyerPaymentProof>`

- [ ] **Step 1: Client lib** — mirror `apps/web/lib/owner/solvency.ts`:

```ts
export type BuyerPaymentProofSnapshotItem = {
  kind: 'RENT' | 'SALE_INSTALLMENT';
  dueDate: string;
  paidAt: string;
  amount: string;
  currency: string;
  daysLate: number;
};

export async function getLatestBuyerPaymentProof(agreementId: string) {
  return apiFetch<PublicBuyerPaymentProof | null>(
    `/sale-agreements/${agreementId}/payment-proofs/latest`,
  );
}

export async function requestBuyerPaymentProof(agreementId: string) {
  return apiFetch<PublicBuyerPaymentProof>(
    `/sale-agreements/${agreementId}/payment-proofs`,
    { method: 'POST' },
  );
}

export function proofKindLabel(kind: 'RENT' | 'SALE_INSTALLMENT'): string {
  return kind === 'RENT' ? 'LOYER' : 'PALIER';
}
```

- [ ] **Step 2: UI block** in `SaleAgreementDetailPage` (after installments / sidebar):
  - On load (with agreement): also fetch latest proof
  - States table from spec (button / pending / table+expire / disabled if create returns `NO_PAID_PAYMENTS` — optionally probe by attempting create or a lightweight heuristic: disable only after 400, or try-catch on click)
  - Prefer: button always shown when status ≠ PENDING and ≠ GRANTED-valid ; on click handle `NO_PAID_PAYMENTS` with helper text
  - Table columns: Type (`proofKindLabel`) · Échéance · Montant · Retard (jours)
  - Hide entire block if agreement `CANCELLED`

- [ ] **Step 3: Manual smoke** — owner login → dossier ACTIVE avec acheteur ayant PAID → demander → voir PENDING.

- [ ] **Step 4: Commit** (si demandé)

---

### Task 5: Mobile acheteur — Mes achats / preuves

**Files:**
- Create: `apps/mobile/lib/buyer-payment-proofs.ts`
- Create: `apps/mobile/app/achats/preuves.tsx`
- Modify: `apps/mobile/app/achats/index.tsx` (lien + badge si ≥1 PENDING)

**Interfaces:**
- `listMyBuyerPaymentProofs()`
- `respondBuyerPaymentProof(id, accept)`

- [ ] **Step 1: Client** — mirror `apps/mobile/lib/solvency.ts` against `/me/buyer-payment-proofs`.

- [ ] **Step 2: Screen `achats/preuves.tsx`** — copy structure from `cahier-loyer/solvency.tsx`:
  - List cards: organizationName + status
  - PENDING: Accepter / Refuser buttons
  - No snapshot amounts before accept
  - After accept: short confirmation text

- [ ] **Step 3: Hub `achats/index.tsx`** — header or list footer link « Preuves de paiements » ; if any PENDING from `listMyBuyerPaymentProofs`, show badge count (fetch in parallel with agreements).

- [ ] **Step 4: Smoke Expo** — buyer account receives notif/list → accept → owner web shows snapshot.

- [ ] **Step 5: Commit** (si demandé)

---

### Task 6: TODOS + final verification

**Files:**
- Modify: `TODOS.md`

- [ ] **Step 1: Update TODOS**
  - Focus actif : S4 preuve acheteur
  - Expand S4 row into:

| # | Item | Accès | Statut |
|---|------|-------|--------|
| S4.0 | Spec design BuyerPaymentProof | 🟡 | ✅ |
| S4.1 | API create/respond/latest + notif | 🔴 | ✅ |
| S4.2 | Mobile acheteur accept/refuse | 🔴 | ✅ |
| S4.3 | Web bloc dossier vente | 🔴 | ✅ |

  - État final : « V3 paliers ✅ · **S4 preuve acheteur ✅ (local)** »

- [ ] **Step 2: Final test run**

```bash
cd apps/api && bunx jest src/sales/buyer-payment-proofs.spec.ts src/sales/sale-agreements.spec.ts --forceExit
```

Expected: all PASS.

- [ ] **Step 3: Commit** (si demandé)

---

## Spec coverage

| Spec | Task |
|------|------|
| Model + statuses + indexes | 1 |
| Snapshot mixte + kinds + no property | 2 |
| Unicité PENDING / CANCELLED / NO_PAID | 2 |
| API owner + /me | 3 |
| Notif BUYER_PAYMENT_PROOF_REQUESTED | 3 |
| Web bloc dossier | 4 |
| Mobile accept/refuse | 5 |
| TODOS | 6 |
| Hors scope (score, hors dossier, SolvencyCheck merge) | — non fait |

## Hors plan

- Cron d’expiration
- Preuve hors `SaleAgreement`
- Fusion avec `SolvencyCheck`
- Types OpenAPI régénérés (optionnel : `pnpm generate:types` si le flux du repo le demande en fin de feature)
