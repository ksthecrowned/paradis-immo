# Messaging Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ledger Infobip OTP (10 free/user/month, overage debt) and org-billed SMS alerts; settle open user debt on platform payments in XAF via fixed FX.

**Architecture:** `MessageCharge` rows recorded only after successful provider send. `MessagingBillingService` owns quota math, balances, and settlement. Payments include `MESSAGING_DEBT` allocation at initiate and mark charges `SETTLED` on validate. SMS path requires `User.notificationChannel = SMS`.

**Tech Stack:** NestJS API, Prisma/Postgres, Infobip WhatsApp + SMS, existing Payments module, Bun tests, Expo mobile + Next web (thin UI).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-12-messaging-billing-design.md`
- OTP never blocked for debt; rate limit stays separate
- `OTP_FREE_PER_MONTH=10`, `OTP_UNIT_USD=0.006`, `SMS_ALERT_UNIT_USD=0.234`
- XAF via fixed `USD_TO_XAF`; snapshot FX on each charge; half-up integer XAF
- Billing month = UTC `YYYY-MM`
- Pre-signup OTP payerId = `phone:{e164}` until verify attaches user
- Settle: debt in amount at initiate; `SETTLED` on payment validate

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Enums + `MessageCharge` + `User.notificationChannel` + `AllocatableType.MESSAGING_DEBT` |
| `apps/api/src/messaging/messaging.config.ts` | Read env defaults for tariffs/FX |
| `apps/api/src/messaging/messaging-billing.service.ts` | recordOtp, recordSms, openBalance, attachPhoneCharges, settle |
| `apps/api/src/messaging/messaging.module.ts` | Nest module |
| `apps/api/src/messaging/infobip-sms.service.ts` | Infobip SMS send |
| `apps/api/src/auth/auth.service.ts` | Call recordOtp after send; attach on verify |
| `apps/api/src/payments/payments.service.ts` | Include debt at initiate; settle on validate |
| `apps/api/src/users/*` | Expose + patch `notificationChannel` |
| `apps/api/src/notifications/*` | Branch SMS vs push |
| `apps/mobile` payment + profile | Show debt line; channel preference |
| `apps/web` agent/owner | Org messaging balance (minimal list) |

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/YYYYMMDDHHMMSS_messaging_billing/migration.sql`
- Modify: `.env.example` (root + `apps/api/.env.example` if present)

**Interfaces:**
- Produces: Prisma models/enums usable by Task 2+

- [ ] **Step 1: Add enums and models**

In `schema.prisma`, add:

```prisma
enum MessageChannel {
  WHATSAPP_OTP
  SMS_ALERT
}

enum MessagePayerType {
  USER
  ORGANIZATION
}

enum MessageChargeStatus {
  FREE
  OPEN
  SETTLED
  WAIVED
}

enum NotificationChannel {
  PUSH
  SMS
}
```

Extend `AllocatableType` with `MESSAGING_DEBT`.

On `User`, add:
```prisma
notificationChannel NotificationChannel @default(PUSH)
messageCharges      MessageCharge[]     @relation("MessageChargeUser")
```

Add model (after Payment section):

```prisma
model MessageCharge {
  id                String              @id @default(cuid())
  channel           MessageChannel
  payerType         MessagePayerType
  payerId           String
  userId            String?
  user              User?               @relation("MessageChargeUser", fields: [userId], references: [id])
  organizationId    String?
  organization      Organization?       @relation(fields: [organizationId], references: [id])
  recipientPhone    String
  occurredAt        DateTime            @default(now())
  billingMonth      String
  unitUsd           Decimal             @db.Decimal(12, 6)
  fxRate            Decimal             @db.Decimal(12, 4)
  amountXaf         Int
  status            MessageChargeStatus
  settledPaymentId  String?
  settledPayment    Payment?            @relation(fields: [settledPaymentId], references: [id])
  providerMessageId String?
  idempotencyKey    String              @unique
  createdAt         DateTime            @default(now())

  @@index([payerType, payerId, status])
  @@index([userId, channel, billingMonth])
  @@index([billingMonth])
}
```

Wire reverse relations on `Organization` and `Payment` as needed.

- [ ] **Step 2: Env keys**

Document in `.env.example`:
```
USD_TO_XAF=600
OTP_FREE_PER_MONTH=10
OTP_UNIT_USD=0.006
SMS_ALERT_UNIT_USD=0.234
INFOBIP_SMS_SENDER=
```

- [ ] **Step 3: Migrate**

Run: `cd apps/api && bunx prisma migrate dev --name messaging_billing`  
Expected: migration applied, client generated.

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma .env.example apps/api/.env.example
git commit -m "feat(api): add MessageCharge schema for messaging billing"
```

---

### Task 2: MessagingBillingService — OTP quota (TDD)

**Files:**
- Create: `apps/api/src/messaging/messaging.config.ts`
- Create: `apps/api/src/messaging/messaging-billing.service.ts`
- Create: `apps/api/src/messaging/messaging-billing.service.spec.ts`
- Create: `apps/api/src/messaging/messaging.module.ts`
- Modify: `apps/api/src/app.module.ts` (import MessagingModule)

**Interfaces:**
- Produces:
  - `phonePayerId(phone: string): string` → `phone:{e164}`
  - `billingMonthUtc(d?: Date): string` → `YYYY-MM`
  - `toXaf(unitUsd: number, fxRate: number): number` half-up int
  - `recordOtp(phone: string, opts?: { providerMessageId?: string; idempotencyKey?: string }): Promise<MessageCharge>`
  - `attachPhoneChargesToUser(phone: string, userId: string): Promise<void>`
  - `openBalanceXaf(payerType: MessagePayerType, payerId: string): Promise<number>`
  - `listOpenCharges(payerType, payerId): Promise<MessageCharge[]>`
  - `settleCharges(paymentId: string, chargeIds: string[]): Promise<void>`
  - `recordSmsAlert(input: { phone; userId; organizationId; providerMessageId?; idempotencyKey? }): Promise<MessageCharge>`

- [ ] **Step 1: Write failing unit tests**

In `messaging-billing.service.spec.ts` (use Prisma test DB pattern from `users.service.spec.ts` / `auth.service.spec.ts`):

```ts
it('first 10 OTPs in month are FREE', async () => { /* recordOtp x10 → all FREE amountXaf 0 */ });
it('11th OTP is OPEN with XAF = round(0.006 * fx)', async () => { /* */ });
it('new UTC month resets free quota', async () => { /* mock occurredAt via clock or insert prior month */ });
it('idempotent recordOtp same key returns same row', async () => { /* */ });
it('attachPhoneChargesToUser rewrites payerId and userId', async () => { /* */ });
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd apps/api && bun test src/messaging/messaging-billing.service.spec.ts`  
Expected: module/service missing or methods missing.

- [ ] **Step 3: Implement config + service**

`messaging.config.ts`:
```ts
export function messagingConfig() {
  const fx = Number(process.env.USD_TO_XAF);
  if (!Number.isFinite(fx) || fx <= 0) {
    throw new Error('USD_TO_XAF must be a positive number');
  }
  return {
    fxRate: fx,
    otpFreePerMonth: Number(process.env.OTP_FREE_PER_MONTH ?? 10),
    otpUnitUsd: Number(process.env.OTP_UNIT_USD ?? 0.006),
    smsUnitUsd: Number(process.env.SMS_ALERT_UNIT_USD ?? 0.234),
  };
}

export function toXaf(unitUsd: number, fxRate: number): number {
  return Math.round(unitUsd * fxRate); // half-up for positive amounts
}

export function billingMonthUtc(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export function phonePayerId(phone: string): string {
  return `phone:${phone}`;
}
```

`recordOtp` logic:
1. Resolve user by phone if exists → `payerId = user.id`, else `phonePayerId(phone)`
2. Count existing `WHATSAPP_OTP` for that payer (or userId) in `billingMonth`
3. Status FREE if count < free quota else OPEN
4. Upsert by `idempotencyKey` (default `otp:{phone}:{billingMonth}:{count+1}` or provider id)

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd apps/api && bun test src/messaging/messaging-billing.service.spec.ts`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/messaging apps/api/src/app.module.ts
git commit -m "feat(api): messaging billing service with OTP free quota"
```

---

### Task 3: Wire Auth OTP send + attach on verify

**Files:**
- Modify: `apps/api/src/auth/auth.module.ts`
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

**Interfaces:**
- Consumes: `MessagingBillingService.recordOtp`, `attachPhoneChargesToUser`
- Produces: OTP requests create charges; verify links phone ledger to user

- [ ] **Step 1: Failing test**

```ts
it('requestOtp records a MessageCharge after successful send', async () => {
  // spy infobip success → assert MessageCharge row exists for phone
});
it('verifyOtp attaches phone:{e164} charges to user', async () => {
  // seed OPEN charge with payerId phone:+242… → verify → payerId = user.id
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement**

In `requestOtp`, after `await this.infobip.sendOtp(...)`:
```ts
await this.messaging.recordOtp(input.phone);
```
If `sendOtp` throws, do not record.

In `verifyOtp`, after `getOrCreateUser`:
```ts
await this.messaging.attachPhoneChargesToUser(input.phone, user.id);
```

Import `MessagingModule` into `AuthModule`.

- [ ] **Step 4: Tests PASS + commit**

```bash
git commit -m "feat(api): record OTP charges and attach on verify"
```

---

### Task 4: Payment initiate includes debt + validate settles

**Files:**
- Modify: `apps/api/src/payments/payments.service.ts`
- Modify: `apps/api/src/payments/payments.controller.ts` (DTO if amount client-driven — prefer server adds debt)
- Modify: `apps/api/src/payments/payments.spec.ts`
- Modify: mobile/web payment clients only if response shape adds `messagingDebtXaf`

**Interfaces:**
- Consumes: `openBalanceXaf('USER', userId)`, `listOpenCharges`, `settleCharges`
- Produces: Payment amount includes debt; allocation `MESSAGING_DEBT`; settle on validate

- [ ] **Step 1: Failing tests**

```ts
it('initiatePayment adds OPEN messaging debt to amount and allocation', async () => {});
it('validateCashPayment marks messaging charges SETTLED', async () => {});
it('failed payment leaves charges OPEN', async () => {});
```

- [ ] **Step 2: Implement**

In `initiatePayment`:
```ts
const debt = await this.messaging.openBalanceXaf('USER', input.userId);
const open = await this.messaging.listOpenCharges('USER', input.userId);
const base = Number(input.amount);
const total = base + debt;
// persist payment with amount=total
// on validate path when creating allocations, if debt>0 push:
// { type: 'MESSAGING_DEBT', refId: userId, amount: debt }
// metadata: { messagingChargeIds: open.map(c => c.id) }
```

In `validateCashPayment` after success:
```ts
const ids = /* from payment.metadata.messagingChargeIds or re-query OPEN at validate time */;
await this.messaging.settleCharges(payment.id, ids);
```

**MVP rule:** re-query OPEN charges for user at validate (same set as initiate if no concurrent OTP — acceptable); store ids in `payment.metadata` at initiate for audit.

- [ ] **Step 3: Tests PASS + commit**

```bash
git commit -m "feat(api): settle messaging debt on payment validate"
```

---

### Task 5: SMS Infobip + notification channel branch

**Files:**
- Create: `apps/api/src/messaging/infobip-sms.service.ts`
- Modify: `apps/api/src/notifications/notifications.service.ts`
- Modify: `apps/api/src/notifications/processors/*.ts` as needed
- Modify: related notification specs
- Modify: `apps/api/src/users/dto/update-me.dto.ts`, `users.service.ts`, PublicUser

**Interfaces:**
- Produces: `InfobipSmsService.send({ to, text })`
- Produces: `recordSmsAlert` after success
- Produces: `PublicUser.notificationChannel`

- [ ] **Step 1: Tests**

```ts
it('recordSmsAlert creates OPEN charge for organization', async () => {});
it('notification uses SMS path when user.notificationChannel is SMS', async () => {});
it('notification uses FCM when channel is PUSH', async () => {});
```

- [ ] **Step 2: Implement SMS sender** (mirror OTP env pattern; log in dev)

- [ ] **Step 3: In notification delivery**, load user; if `SMS`, require `organizationId` from event context; fail send if missing org; else send SMS + `recordSmsAlert`

- [ ] **Step 4: Add `notificationChannel` to getMe/updateMe DTO (`IsIn(['PUSH','SMS'])`)

- [ ] **Step 5: Tests PASS + commit**

```bash
git commit -m "feat(api): SMS alerts billed to organization"
```

---

### Task 6: Org open balance API (minimal)

**Files:**
- Create: `apps/api/src/messaging/messaging.controller.ts`
- Modify: `messaging.module.ts`

**Interfaces:**
- `GET /messaging/org/:organizationId/balance` → `{ openBalanceXaf, charges: [...] }` guarded for org members
- Optional MVP: `POST /messaging/org/:organizationId/settle` creating a payment of type messaging-only — if too heavy, document manual settle via existing payment with metadata; **prefer** settle helper that creates payment + validates for org treasurer role.

- [ ] **Step 1: GET balance endpoint + test**
- [ ] **Step 2: Commit**

```bash
git commit -m "feat(api): organization messaging balance endpoint"
```

---

### Task 7: Mobile — debt line + channel preference

**Files:**
- Modify: `apps/mobile/lib/users.ts` / profile edit
- Modify: `apps/mobile/app/payment/[id].tsx` (and rent/visit initiate if amount computed client-side — prefer trusting API payment amount)
- Modify: `apps/mobile/lib/payments.ts` if response includes `messagingDebtXaf`

- [ ] **Step 1:** Profile edit: segment PUSH | SMS with copy « Les SMS sont facturés à l’agence »
- [ ] **Step 2:** Payment UI: if `messagingDebtXaf > 0`, show « Frais OTP » line
- [ ] **Step 3:** Commit

```bash
git commit -m "feat(mobile): messaging channel preference and OTP debt on payment"
```

---

### Task 8: Web org — balance list (thin)

**Files:**
- Create or modify agent/owner page under `apps/web` (e.g. extend payments or new `messaging` section)
- Create: `apps/web/lib/agent/messaging.ts` fetch balance

- [ ] **Step 1:** Simple table open SMS charges + total XAF
- [ ] **Step 2:** Commit

```bash
git commit -m "feat(web): show organization messaging SMS balance"
```

---

### Task 9: Verify against success criteria

- [ ] **Step 1:** Run API unit suite for messaging + payments + auth touched files
- [ ] **Step 2:** Manual checklist from spec success criteria
- [ ] **Step 3:** Commit any test fixes only

---

## Spec coverage (self-review)

| Spec requirement | Task |
|------------------|------|
| MessageCharge ledger + FX snapshot | 1–2 |
| 10 free OTP / overage OPEN | 2–3 |
| Never block OTP for debt | 3 |
| Attach phone:{e164} on verify | 2–3 |
| Debt on any user payment + settle validate | 4 |
| SMS pref explicit + org billed 0.234 | 5 |
| Org balance UI/API | 6–8 |
| Mobile debt line + channel | 7 |
| Tests | 2–5, 9 |

No TBD placeholders. Types aligned on `MessagingBillingService` methods above.
