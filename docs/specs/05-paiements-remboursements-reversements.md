# 05 — Paiements, remboursements, litiges et reversements

## Objectif et rôles
Rendre les flux d'argent réels, sûrs et traçables :
- encaissements Airtel et MoMo, plus espèces et virement ;
- montants contrôlés côté serveur ;
- remboursements ;
- litiges ;
- reversements aux propriétaires et restitutions de caution ;
- rapprochement.

Rôles : payeurs (`TENANT`, `GUEST`, `BUYER`, `SEEKER` pour une visite payante), `MANAGER` et `AGENT` (validation espèces), `OWNER` (bénéficiaire), `PLATFORM_ADMIN` (finance).

## État actuel (audit)
- `MobileMoneyProvider.initiate` est un **stub** qui renvoie une fausse session. Le webhook vérifie un HMAC générique, sans contrat réel Airtel ni MTN.
- `initiatePayment` :
  - le **montant vient du client** et n'est pas comparé au reste dû ;
  - le payeur n'est pas vérifié pour une échéance de loyer (n'importe qui peut payer, ou fausser l'allocation) ;
  - pas de type `bookingId` (séjour) ; seules les visites, loyers et échéances de vente sont pris en charge ;
  - `PAYMENT_INITIATED` est émis avec `paymentId: booking.id` côté bookings (placeholder).
- Statut `DISPUTED` présent, sans flux. Pas de remboursement, de reversement, d'expiration des paiements INITIATED ni de polling de statut.
- `listMyPayments`, `listManaged` : sans pagination.
- Web : `/agent/payments/validation` et `/agent/payments/[id]` existent, mais pas de liste globale des paiements côté agent.
- Mobile : `payment/[id]` envoie bien le provider. Pas d'écran d'attente de confirmation USSD robuste.

## User stories
1. En tant que payeur, je choisis Airtel ou MoMo et je saisis mon numéro (prérempli). Je reçois la demande USSD et l'app affiche l'attente avec un compte à rebours, puis le succès ou l'échec.
2. Si je ferme l'app, le statut est mis à jour par webhook, ou par polling serveur en secours. Je reçois une notification du résultat.
3. Je ne peux payer que ce que je dois. Le montant est calculé par le serveur ; un paiement partiel n'est autorisé que si le gestionnaire l'a activé.
4. En tant que gestionnaire, j'enregistre un paiement en espèces ou par virement, avec la pièce justificative. Un autre membre (ou moi, selon la configuration) le valide (principe des 4 yeux en option).
5. En tant que gestionnaire, je consulte tous les paiements de mon périmètre, avec filtres (statut, méthode, bien, période) et export CSV.
6. En tant que payeur, je conteste un paiement (« débité mais non crédité », « doublon »). Le gestionnaire ou l'admin traite la contestation.
7. En tant que gestionnaire ou admin, je rembourse totalement ou partiellement :
   - séjour annulé ;
   - visite payante annulée par l'agence ;
   - doublon ;
   - caution.
8. En tant que propriétaire, je reçois mes reversements (net du ledger, voir 03) sur mon compte mobile money ou bancaire, selon une fréquence (mensuelle, ou à la demande au-dessus d'un seuil).
9. En tant que finance plateforme (admin), je rapproche les transactions du fournisseur avec nos paiements (fichier de relevé ou API) et je traite les écarts.

## Règles métier
- **Montant serveur** : `amount` n'est plus accepté du client. Il est calculé selon la cible :
  - `RentSchedule` : `amount + chargesPart + lateFee − amountPaid` ;
  - `SaleInstallment` : reste dû ;
  - `Booking` : `totalPrice` (07) ;
  - `VisitBooking` : prix du créneau.
  - Exception : un `amount` inférieur est accepté si `allowPartialPayments` est activé sur le bail ; il doit être au moins égal à `minPartialAmount`.
- **Autorisation du payeur**
  - Loyer : locataire principal ou colocataire.
  - Échéance de vente : acheteur.
  - Séjour et visite : titulaire de la réservation.
  - Dans tous les autres cas : 403 `NOT_PAYER`.
- **Expiration** : un paiement `INITIATED` sans confirmation passe en `EXPIRED` après 15 minutes (cron toutes les 5 minutes, avec interrogation du fournisseur via `getStatus` avant expiration).
- **Unicité** : un seul paiement mobile money INITIATED par cible à la fois. Une nouvelle tentative annule la précédente côté serveur (`CANCELLED`).
- **Webhooks**
  - Un adaptateur par fournisseur (Airtel Money API, MTN MoMo Collection API), chacun avec sa propre vérification de signature ou de token et sa propre allowlist IP.
  - Idempotents par `providerRef`. Le payload brut est journalisé dans `PaymentEvent`.
- **États** : `INITIATED` → `PENDING_VALIDATION` (espèces et virement) | `VALIDATED` | `FAILED` | `EXPIRED` | `CANCELLED` ; `VALIDATED` → `DISPUTED` → `VALIDATED` | `REFUNDED` | `PARTIALLY_REFUNDED`.
- **Validation espèces** : `validatedBy` ne peut pas être `recordedBy` si `org.requireDualCashValidation`. La pièce justificative est obligatoire pour un virement.
- **Remboursements**
  - Montant ≤ (payé − déjà remboursé).
  - Exécutés via l'API de disbursement du fournisseur vers le numéro payeur d'origine, ou marqués « remboursé en espèces » avec justificatif.
  - Un remboursement inverse les écritures du ledger (`REFUND`) et l'allocation (l'échéance repasse PENDING ou PARTIAL).
  - Au-delà de `refundApprovalThreshold`, l'approbation d'un ADMIN plateforme est requise.
- **Litiges**
  - Ouverture jusqu'à 30 jours après le paiement.
  - Pendant le litige, l'argent concerné est exclu du reversement.
  - Une réponse du gestionnaire est attendue sous 72 h, sinon escalade à l'admin.
- **Reversements**
  - Calculés à partir du ledger (03). Bénéficiaire : `PayoutAccount` vérifié (numéro mobile money au nom du propriétaire, ou IBAN/RIB).
  - Cron mensuel le 10. Le versement à la demande est possible si solde ≥ `minPayoutAmount`.
  - Les frais de transfert sont imputés selon la configuration (propriétaire par défaut).
  - Statuts : `PENDING` → `PROCESSING` → `PAID` | `FAILED`. Un échec n'est pas retenté automatiquement : il est notifié à la finance.
- **Rapprochement** : import CSV du relevé fournisseur. On fait correspondre `providerRef`, montant et date ; les écarts (`MISSING_IN_DB`, `MISSING_AT_PROVIDER`, `AMOUNT_MISMATCH`) sont listés.
- **Événements**
  - `PAYMENT_INITIATED` : le bon `paymentId`, en corrigeant le placeholder de bookings.
  - `PAYMENT_VALIDATED` : existant.
  - Nouveaux : `PAYMENT_FAILED`, `PAYMENT_EXPIRED`, `PAYMENT_DISPUTED`, `PAYMENT_REFUNDED`, `PAYOUT_PAID`, `PAYOUT_FAILED`.

## Modèle de données
```prisma
enum PaymentStatus { INITIATED PENDING_VALIDATION VALIDATED FAILED EXPIRED CANCELLED DISPUTED REFUNDED PARTIALLY_REFUNDED }
enum RefundStatus { REQUESTED APPROVED PROCESSING SUCCEEDED FAILED REJECTED }
enum DisputeStatus { OPEN AWAITING_MANAGER ESCALATED RESOLVED_ACCEPTED RESOLVED_REJECTED }
enum PayoutStatus { PENDING PROCESSING PAID FAILED CANCELLED }
enum PayoutAccountType { MOBILE_MONEY BANK }

model Payment {
  // + champs
  bookingId       String?
  payerPhone      String?
  providerRef     String?   @unique
  recordedById    String?
  proofKey        String?
  expiresAt       DateTime?
  failureReason   String?
  refundedAmount  Decimal   @default(0)
  events          PaymentEvent[]
  refunds         Refund[]
  disputes        PaymentDispute[]
}

model PaymentEvent {
  id        String   @id @default(cuid())
  paymentId String?
  provider  String
  kind      String   // INITIATE_REQUEST | INITIATE_RESPONSE | WEBHOOK | STATUS_POLL
  payload   Json
  signatureValid Boolean?
  createdAt DateTime @default(now())
}

model Refund {
  id           String       @id @default(cuid())
  paymentId    String
  amount       Decimal
  reason       String
  status       RefundStatus @default(REQUESTED)
  method       String       // PROVIDER | CASH
  providerRef  String?
  requestedById String
  approvedById String?
  proofKey     String?
  createdAt    DateTime     @default(now())
  processedAt  DateTime?
}

model PaymentDispute {
  id          String        @id @default(cuid())
  paymentId   String
  openedById  String
  reason      String        // NOT_CREDITED | DUPLICATE | WRONG_AMOUNT | OTHER
  description String
  evidenceKeys String[]
  status      DisputeStatus @default(OPEN)
  resolution  String?
  resolvedById String?
  createdAt   DateTime      @default(now())
  resolvedAt  DateTime?
}

model PayoutAccount {
  id             String            @id @default(cuid())
  organizationId String
  type           PayoutAccountType
  provider       PaymentProvider?
  phone          String?
  bankName       String?
  accountNumber  String?
  holderName     String
  verifiedAt     DateTime?
  isDefault      Boolean           @default(false)
}

model Payout {
  id              String       @id @default(cuid())
  organizationId  String       // bénéficiaire (propriétaire)
  payoutAccountId String
  amount          Decimal
  fee             Decimal      @default(0)
  currency        String
  periodStart     DateTime?
  periodEnd       DateTime?
  kind            String       // OWNER_NET | DEPOSIT_REFUND
  status          PayoutStatus @default(PENDING)
  providerRef     String?
  failureReason   String?
  createdAt       DateTime     @default(now())
  paidAt          DateTime?
}

model ReconciliationRun {
  id        String   @id @default(cuid())
  provider  String
  fileKey   String
  periodStart DateTime
  periodEnd   DateTime
  summary   Json
  createdById String
  createdAt DateTime @default(now())
  lines     ReconciliationLine[]
}

model ReconciliationLine { id String @id @default(cuid()) runId String providerRef String? paymentId String? kind String amountProvider Decimal? amountDb Decimal? resolved Boolean @default(false) }

model Organization {
  // + paramètres finance
  requireDualCashValidation Boolean @default(false)
  payoutFrequency           String  @default("MONTHLY") // MONTHLY | ON_DEMAND
  minPayoutAmount           Decimal @default(10000)
}
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `payments` | payeur | **Modifié** : `{ target: { type, id }, method, provider?, phone?, amount? (partiel), idempotencyKey }`. Montant calculé côté serveur |
| GET | `payments/:id/status` | payeur | Statut, avec interrogation du fournisseur si INITIATED |
| POST | `payments/:id/cancel` | payeur | Annule un INITIATED |
| GET | `payments/quote` | payeur | `?targetType&targetId` : montant dû, partiel autorisé, minimum |
| GET | `payments/mine` | auth | **Modifié** : paginé |
| GET | `payments/managed` | gestionnaire | **Modifié** : pagination et filtres `status`, `method`, `propertyId`, `from`, `to` |
| GET | `payments/managed/export.csv` | gestionnaire | Export |
| POST | `payments/cash` | gestionnaire | Existant ; ajouter `proofKey` et la méthode BANK_TRANSFER |
| POST | `payments/webhooks/airtel` | fournisseur | Adaptateur Airtel |
| POST | `payments/webhooks/momo` | fournisseur | Adaptateur MTN |
| POST | `payments/:id/disputes` | payeur | Ouvre un litige |
| GET | `disputes/managed` | gestionnaire | Litiges du périmètre |
| PATCH | `disputes/:id` | gestionnaire / admin | `{ status, resolution }` |
| POST | `payments/:id/refunds` | gestionnaire / admin | `{ amount, reason, method }` |
| PATCH | `refunds/:id` | admin | Approuve ou rejette (au-dessus du seuil) |
| CRUD | `organizations/:id/payout-accounts` | OWNER (ADMIN org) | Comptes de reversement (vérification par micro-dépôt de 1 XAF ou OTP fournisseur) |
| GET | `payouts/mine` | OWNER | Reversements reçus |
| POST | `payouts/request` | OWNER | Reversement à la demande |
| GET | `admin/payouts` | admin | File des reversements |
| POST | `admin/payouts/:id/retry` | admin | Relance manuelle |
| POST | `admin/reconciliation` | admin | Import d'un relevé |
| GET | `admin/reconciliation/:id` | admin | Écarts |

## Écrans
- **Mobile, payeur**
  - `payment/[id]` : montant non modifiable (sauf partiel autorisé, avec curseur entre min et max), écran d'attente USSD (compte à rebours de 15 minutes, « Je n'ai rien reçu » qui relance), états succès, échec et expiration.
  - Historique paginé.
  - « Signaler un problème » sur un paiement, pour ouvrir un litige.
- **Web, agent**
  - `/agent/payments` (nouveau) : liste et filtres, avec la validation existante dans un onglet.
  - `payments/[id]` : timeline des `PaymentEvent`, remboursements, litiges.
  - `/agent/disputes`.
- **Web, owner**
  - `/owner/payments` : ajouter un onglet « Reversements ».
  - `/owner/settings/payout` : comptes de reversement.
- **Admin** : `/admin/finance` avec paiements, remboursements à approuver, reversements et rapprochement (12).

## Critères d'acceptation
- Un `POST payments` avec `amount` différent du dû, sur un bail sans partiel autorisé, renvoie 400 `AMOUNT_MISMATCH`.
- Un utilisateur qui n'est pas locataire et paie une échéance reçoit 403 `NOT_PAYER`.
- Un paiement INITIATED non confirmé passe à EXPIRED après 15 minutes et n'est jamais alloué.
- Deux webhooks identiques (même `providerRef`) ne créent qu'une allocation et qu'un reçu.
- En sandbox Airtel et MTN, un paiement réel aboutit à VALIDATED de bout en bout (test d'intégration manuel documenté).
- Le remboursement total d'un loyer repasse l'échéance en PENDING et crée l'écriture `REFUND` dans le ledger.
- Un reversement mensuel = solde du ledger hors montants en litige.
- `PAYMENT_INITIATED` contient l'identifiant de paiement réel (test sur bookings).

## Priorité
- **P0** : intégration réelle Airtel et MoMo, montant calculé côté serveur, contrôle du payeur, expiration, paiement de séjour (`bookingId`), correction du placeholder d'événement.
- **P1** : remboursements, liste et filtres côté gestionnaire, reversements aux propriétaires, comptes de reversement, litiges.
- **P2** : double validation espèces, rapprochement, export CSV.
