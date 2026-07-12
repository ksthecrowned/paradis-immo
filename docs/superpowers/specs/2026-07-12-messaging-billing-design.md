# Messaging Billing (OTP + SMS alerts) — Design Spec

**Date:** 2026-07-12  
**Status:** Approved in brainstorming  
**Scope:** Quotas and ledger for Infobip WhatsApp OTP (per end-user) and SMS alerts (billed to managing organization); settle open charges on platform payments. Currency: XAF via fixed USD→XAF rate.

## Goal

- Give each **end-user** 10 free WhatsApp OTP messages per calendar month.
- Do **not** block OTP when the free quota is exceeded; accrue debt and collect it on the **next platform payment** (rent, paid visit, stay, etc.).
- Send operational **SMS alerts** to tenants who explicitly choose SMS (no smartphone / no push); bill the **managing Organization** at US$0.234 per SMS.
- Keep an auditable ledger aligned with Infobip unit costs, settled in XAF.

## Decisions

| Topic | Choice |
|-------|--------|
| Free OTP quota owner | End-user account (A) |
| Free quota | 10 WhatsApp OTP / calendar month |
| OTP overage | Allowed; charge OPEN; never block send |
| OTP debt settlement | Included in **any** next user platform payment |
| SMS channel selection | Explicit preference `notificationChannel = SMS` |
| SMS payer | Managing **Organization** (agency) |
| SMS unit cost | US$0.234 |
| OTP unit cost (overage) | US$0.006 |
| Currency | Ledger amounts in **XAF** using **fixed** `USD_TO_XAF` config |
| Architecture | Message charge ledger + settlement at payment (Approach 1) |

## Non-goals

- Prepaid messaging wallet
- Monthly batch-only invoicing without in-app settlement
- Blocking SMS when org debt is high (YAGNI for MVP)
- WhatsApp for non-OTP product alerts
- Automatic SMS solely because `fcmToken` is missing (preference must be explicit)
- Real-time FX from markets (fixed admin/env rate only)

## Tariffs & config

| Key | Default | Notes |
|-----|---------|--------|
| `OTP_FREE_PER_MONTH` | `10` | Per user, calendar month `YYYY-MM` |
| `OTP_UNIT_USD` | `0.006` | Infobip WhatsApp OTP overage |
| `SMS_ALERT_UNIT_USD` | `0.234` | Infobip SMS alert |
| `USD_TO_XAF` | admin/env | Fixed; snapshotted **onto each charge at creation** |

`amountXaf = round(unitUsd * fxRate)` (rounding rule: half-up to integer XAF).

## Data model

### `MessageCharge`

Atomic ledger row for one billable (or free) send.

| Field | Type | Notes |
|-------|------|--------|
| `id` | cuid | |
| `channel` | enum | `WHATSAPP_OTP` \| `SMS_ALERT` |
| `payerType` | enum | `USER` \| `ORGANIZATION` |
| `payerId` | string | User id or Organization id |
| `userId` | string? | Recipient / OTP subject when known |
| `organizationId` | string? | Context org for SMS (usually = payer when org) |
| `recipientPhone` | string | E.164 |
| `occurredAt` | datetime | |
| `billingMonth` | string | `YYYY-MM` from `occurredAt` (user local or UTC — **pick UTC**) |
| `unitUsd` | decimal | Snapshot |
| `fxRate` | decimal | `USD_TO_XAF` at creation |
| `amountXaf` | int | `0` when `FREE` |
| `status` | enum | `FREE` \| `OPEN` \| `SETTLED` \| `WAIVED` |
| `settledPaymentId` | string? | FK Payment when settled |
| `providerMessageId` | string? | Infobip id if available |
| `idempotencyKey` | string unique | Prevent double-charge |

Indexes: `(payerType, payerId, status)`, `(userId, channel, billingMonth)`, `(billingMonth)`.

### Payment allocations

Extend `AllocatableType` with `MESSAGING_DEBT`.

- `refId` can be a settlement batch id or the payer id; prefer a `MessagingSettlement` id grouping charge ids in metadata for audit.
- MVP simplification: one allocation with `amount = sum(OPEN charges)`, `refId = payerId`, metadata lists charge ids.

### User preference

- `User.notificationChannel`: `PUSH` (default) \| `SMS`
- Settable on profile edit and/or lease onboarding; **required explicit SMS** for SMS path.

## Flows

### OTP (WhatsApp)

```
requestOtp → Infobip send
  → on provider success only:
       MessagingBilling.recordOtp(phone)
         resolve userId if account exists
         count WHATSAPP_OTP for (userId|phone) in billingMonth
         if count < OTP_FREE_PER_MONTH → FREE (amountXaf=0)
         else → OPEN (unitUsd=OTP_UNIT_USD)
  → existing rate limit (e.g. requests/hour) unchanged — separate from free quota
```

- OTP is **never** refused because of open messaging debt.
- If send fails, **no** `MessageCharge`.
- Phone-only charges (pre-signup): create row with `recipientPhone`, `userId=null`, `payerType=USER`, `payerId` temporarily set to a deterministic sentinel `phone:{e164}` **or** leave `payerId` empty until verify — **MVP pick:** `payerId = phone:{e164}` until `verifyOtp` rewrites `payerId`/`userId` to the real user id (and merges open balance).

### SMS alerts

```
notification event for tenant
  → if notificationChannel != SMS → existing push path
  → else Infobip SMS
       → on success: MessageCharge SMS_ALERT
            payerType=ORGANIZATION
            payerId=managing org of lease/property
            status=OPEN
```

Managing org = property `organizationId` (or mandate org — use same rule as portfolio/managed listings today).

### Settlement (user OTP debt)

On user payment initiate (or validate — **pick validate success** as settle moment; **initiate** must already include debt in quoted amount):

1. `sum OPEN` where `payerType=USER` and `payerId=currentUser`
2. Add to payment total + allocation `MESSAGING_DEBT`
3. Client shows line item « Frais OTP / messaging »
4. On payment **VALIDATED**: mark those charges `SETTLED`, set `settledPaymentId`
5. On fail/cancel: charges remain `OPEN`

Applies to rent, paid visit, short stay, and any future user-initiated platform payment.

### Settlement (org SMS debt)

Same ledger rules; settlement via org-scoped payment or « Régler dette messaging » action by org member with payment permission. Dashboard shows open SMS balance.

## API / services (sketch)

| Piece | Role |
|-------|------|
| `MessagingBillingService` | recordOtp, recordSmsAlert, openBalance(payer), settle(paymentId, chargeIds) |
| `InfobipOtpService` | unchanged send; caller records charge after success |
| `InfobipSmsService` (new) | SMS send for alerts |
| Payments | include open user messaging debt in amount + allocation; settle on validate |
| Users | `notificationChannel` on get/patch me |
| Org dashboard | list open SMS charges + settle |

## UI

| Surface | Behavior |
|---------|----------|
| Mobile payment | Show messaging debt line when > 0; total includes it |
| Mobile / web profile | Toggle or select PUSH vs SMS (copy: coût SMS facturé à l’agence) |
| Agent/owner web | Org messaging balance + history |

## Error handling

| Case | Behavior |
|------|----------|
| Infobip failure | No charge; existing OTP/notif error to client |
| Duplicate webhook/retry | Idempotent `idempotencyKey` |
| Missing org on SMS | Log + skip charge or WAIVE — prefer **fail send** if org unknown (data integrity) |
| FX missing | Refuse recording charge; alert ops (config required in prod) |

## Testing

- Unit: 1st–10th OTP in month → FREE; 11th → OPEN with correct XAF
- Unit: month rollover resets free count
- Unit: settle marks only intended OPEN charges
- Unit: SMS charge attributed to organization
- E2E: overage OTP then rent payment total includes debt; after validate, balance 0

## Success criteria

1. Users get 10 free OTPs/month; further OTPs still send and accrue OPEN debt.  
2. Open user messaging debt is added to the next platform payment and cleared on validation.  
3. SMS-only tenants generate org-billed SMS charges at the configured XAF equivalent of US$0.234.  
4. Every charge stores unit USD + FX snapshot + amount XAF.  
5. No charge without a successful provider send.

## Open implementation notes (resolved for MVP)

- **Billing month TZ:** UTC.  
- **Settle timing:** amount includes debt at **initiate**; status flip to SETTLED on **validate**.  
- **Rounding:** integer XAF, half-up.
