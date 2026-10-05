# 08 — Vente

## Objectif et rôles
Couvrir le parcours de vente :
1. demande de l'acheteur, qualification et visite ;
2. offre et contre-offre ;
3. validation par le propriétaire ;
4. compromis (`SaleAgreement`) et échéancier ;
5. preuve de fonds ;
6. transfert de propriété et clôture.

Rôles : `BUYER` / `SEEKER`, `AGENT`, `MANAGER`, `OWNER`.

## État actuel (audit)
- **Mobile** : `sale-inquiry.tsx` simule l'envoi (`setTimeout`) ; `createSaleInquiry` n'est jamais appelée. Budget et téléphone ne sont pas envoyés.
- **`SaleInquiry`**
  - Modèle limité à `message` et `status` (NEW, CONTACTED, VISIT_SCHEDULED, CLOSED). Pas de budget, de téléphone, de financement, d'anti-doublon ni de notification à l'agence.
  - `listInquiriesForManager` ne retient que les membres AGENT de l'org du bien : le gérant ADMIN et l'agence mandatée sont exclus.
- **`SaleAgreement`** : DRAFT, ACTIVE, COMPLETED, CANCELLED.
  - `complete()` ne passe pas le bien en `SOLD`.
  - `cancel()` ne remet pas `UNDER_OFFER` en `AVAILABLE`.
  - `listMine` (acheteur) masque les DRAFT.
- Pas d'offre ou de contre-offre, pas de validation du propriétaire, pas d'approbation de prix pour le mandat.
- `BuyerPaymentProof` (consentement à la preuve de fonds) : flux existant avec notification.
- `SaleInstallment` : échéancier payable via `payments`.
- Pas de documents de vente (compromis signé, acte notarié, attestation de paiement), ni de notaire ou d'étapes de transfert de titre.

## User stories
1. En tant qu'acheteur, j'envoie une demande sur un bien en vente avec mon message, mon budget, mon mode de financement (comptant, échelonné, crédit) et mon téléphone (prérempli, modifiable). L'agence est notifiée immédiatement.
2. Je ne peux pas envoyer deux demandes ouvertes sur le même bien. Je suis ma demande (statut, agent attribué) dans l'app.
3. En tant qu'agent, je qualifie la demande (statut, notes internes, prochaine action) et je propose une visite (06).
4. En tant qu'acheteur, je fais une offre : prix, conditions (échelonnement, délai, condition suspensive de financement), validité de 7 jours par défaut.
5. En tant qu'agent, je transmets l'offre au propriétaire (approbation `SALE_OFFER_ACCEPT`, voir 03) ou je contre-propose dans les limites du mandat (`minSalePrice`).
6. En tant que propriétaire, j'accepte, je refuse ou je contre-propose. Une offre acceptée met le bien `UNDER_OFFER` et refuse automatiquement les autres offres ouvertes (avec message).
7. L'offre acceptée génère un `SaleAgreement` DRAFT pré-rempli : prix, échéancier proposé selon les conditions, acompte.
8. Le compromis est signé (OTP) par l'acheteur et le vendeur, puis activé. L'acompte devient la première échéance.
9. L'agent demande une preuve de fonds (existant) avant ou après l'offre.
10. Je suis les étapes jusqu'à la clôture :
    - acompte reçu ;
    - échéances payées ;
    - désignation du notaire ;
    - acte signé ;
    - titre foncier transféré.
    Chaque étape porte une date et un document.
11. À la clôture, le bien passe `SOLD`, l'annonce est retirée, la commission de l'agence est calculée (03), et l'acheteur reçoit l'attestation de paiement intégral.
12. En cas d'annulation (rétractation, défaut de paiement), l'acompte est conservé ou remboursé selon les clauses, et le bien redevient `AVAILABLE`.

## Règles métier
- **Demande** : unique par (`propertyId`, `userId`) parmi les statuts ouverts (`NEW`, `CONTACTED`, `VISIT_SCHEDULED`, `OFFER_MADE`).
  - Le téléphone saisi est conservé sur la demande et peut différer de celui du compte.
  - Rate limit : 10 demandes par jour et par utilisateur.
- **Périmètre gestionnaire** : via `AgencyAccessService` (mandat avec scope `SALE`, ou membres ADMIN et AGENT de l'org du bien).
  - L'agent assigné au mandat est attribué par défaut à la demande.
  - Notification `SALE_INQUIRY_CREATED` à l'agent attribué et aux ADMIN.
- **Offres**
  - Statuts : `SUBMITTED` → `FORWARDED` (au propriétaire) → `ACCEPTED` | `REJECTED` | `COUNTERED` | `EXPIRED` | `WITHDRAWN`.
  - Une contre-offre crée une nouvelle `SaleOffer` liée (`parentOfferId`), et l'offre précédente passe COUNTERED.
  - Une seule offre ACCEPTED par bien à la fois.
  - Sans mandat, le propriétaire décide directement. Avec mandat, au-dessus de `minSalePrice`, l'agent peut accepter si le mandat l'y autorise (`agentCanAcceptAboveMin`) ; sinon une approbation est requise.
- **Statut du bien**
  - Offre ACCEPTED : `UNDER_OFFER`.
  - `SaleAgreement.complete()` : `SOLD` et `Property.status = ARCHIVED` (retiré de la recherche).
  - `cancel()`, ou expiration de l'offre acceptée sans compromis signé sous 15 jours : retour à `AVAILABLE`, si aucune autre offre n'est ACCEPTED.
- **Compromis**
  - `DRAFT` → `PENDING_SIGNATURE` → `ACTIVE` → `COMPLETED` | `CANCELLED`.
  - Activation possible seulement si les deux signatures sont présentes.
  - L'échéancier est verrouillé une fois ACTIVE ; une modification passe par un avenant signé.
- **Visibilité acheteur** : l'acheteur voit le compromis dès `PENDING_SIGNATURE` (aujourd'hui, DRAFT masqué ; on garde DRAFT masqué).
- **Clôture** : `complete()` exige toutes les échéances PAID et l'étape `DEED_SIGNED`. `TITLE_TRANSFERRED` peut arriver après (suivi post-clôture).
- **Annulation** : motif obligatoire (`BUYER_WITHDRAWAL`, `PAYMENT_DEFAULT`, `SELLER_WITHDRAWAL`, `OTHER`). La politique d'acompte (`depositForfeitOnBuyerWithdrawal`) définit la retenue ; le remboursement passe par 05.
- **Défaut de paiement** : une échéance en retard de plus de 30 jours entraîne une alerte au gestionnaire et au propriétaire, puis une mise en demeure (modèle PDF).
- **Événements** : `SALE_INQUIRY_CREATED`, `SALE_OFFER_SUBMITTED`, `SALE_OFFER_DECIDED`, `SALE_AGREEMENT_SIGNED`, `SALE_AGREEMENT_COMPLETED`, `SALE_AGREEMENT_CANCELLED`, `SALE_INSTALLMENT_DUE` (rappels comme pour les loyers).

## Modèle de données
```prisma
enum SaleInquiryStatus { NEW CONTACTED VISIT_SCHEDULED OFFER_MADE CLOSED_WON CLOSED_LOST }
enum FinancingType { CASH INSTALLMENTS BANK_LOAN }
enum SaleOfferStatus { SUBMITTED FORWARDED ACCEPTED REJECTED COUNTERED EXPIRED WITHDRAWN }
enum SaleAgreementStatus { DRAFT PENDING_SIGNATURE ACTIVE COMPLETED CANCELLED }
enum SaleMilestoneType { DEPOSIT_RECEIVED INSTALLMENTS_PAID NOTARY_APPOINTED DEED_SIGNED TITLE_TRANSFERRED KEYS_HANDED }

model SaleInquiry {
  // + champs
  phone          String?
  budget         Decimal?
  financing      FinancingType?
  assignedAgentId String?
  internalNotes  String?
  nextActionAt   DateTime?
  lostReason     String?
  offers         SaleOffer[]
}

model SaleOffer {
  id            String          @id @default(cuid())
  propertyId    String
  inquiryId     String?
  buyerId       String
  parentOfferId String?
  authorSide    String          // BUYER | SELLER
  price         Decimal
  currency      String
  financing     FinancingType
  depositAmount Decimal?
  installmentsCount Int?
  conditions    String?
  validUntil    DateTime
  status        SaleOfferStatus @default(SUBMITTED)
  approvalId    String?
  decidedById   String?
  decidedAt     DateTime?
  decisionNote  String?
  createdAt     DateTime        @default(now())
  @@index([propertyId, status])
}

model SaleAgreement {
  // + champs
  offerId             String?   @unique
  depositAmount       Decimal?
  buyerSignedAt       DateTime?
  sellerSignedAt      DateTime?
  sellerSignedById    String?
  notaryName          String?
  notaryContact       String?
  cancelReason        String?
  cancelledById       String?
  depositForfeitOnBuyerWithdrawal Boolean @default(true)
  milestones          SaleMilestone[]
  documents           SaleDocument[]
}

model SaleMilestone { id String @id @default(cuid()) agreementId String type SaleMilestoneType occurredAt DateTime documentId String? note String? createdById String @@unique([agreementId, type]) }

model SaleDocument { id String @id @default(cuid()) agreementId String type String fileKey String name String uploadedById String createdAt DateTime @default(now()) } // COMPROMIS | DEED | TITLE | PAYMENT_CERTIFICATE | OTHER

model Mandate {
  agentCanAcceptAboveMin Boolean @default(false)
}
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `sales/inquiries` | BUYER | **Modifié** : `{ propertyId, message, phone, budget, financing }`, 409 si doublon |
| GET | `sales/inquiries/mine` | BUYER | Avec statut et agent |
| DELETE | `sales/inquiries/:id` | BUYER | Retirer |
| GET | `sales/inquiries/managed` | gestionnaire | **Modifié** : périmètre via mandat, filtres, pagination |
| PATCH | `sales/inquiries/:id` | gestionnaire | `{ status, assignedAgentId, internalNotes, nextActionAt, lostReason }` |
| POST | `properties/:id/offers` | BUYER | Faire une offre |
| GET | `properties/:id/offers` | gestionnaire / OWNER | Offres du bien (fil des contre-offres) |
| GET | `sales/offers/mine` | BUYER | |
| POST | `sales/offers/:id/forward` | AGENT | Transmet au propriétaire (crée l'approbation) |
| POST | `sales/offers/:id/accept` | OWNER / AGENT autorisé | |
| POST | `sales/offers/:id/reject` | OWNER / AGENT | `{ note }` |
| POST | `sales/offers/:id/counter` | OWNER / AGENT / BUYER | `{ price, conditions, validUntil }` |
| POST | `sales/offers/:id/withdraw` | auteur | |
| POST | `sales/offers/:id/agreement` | gestionnaire | Génère un compromis DRAFT |
| POST | `sale-agreements/:id/send-for-signature` | gestionnaire | |
| POST | `sale-agreements/:id/sign` | acheteur / vendeur | OTP |
| POST | `sale-agreements/:id/milestones` | gestionnaire | `{ type, occurredAt, documentId? }` |
| POST | `sale-agreements/:id/documents` | gestionnaire | Upload |
| POST | `sale-agreements/:id/complete` | gestionnaire | **Modifié** : prérequis, statut SOLD, commission |
| POST | `sale-agreements/:id/cancel` | gestionnaire / OWNER | **Modifié** : motif, acompte, retour AVAILABLE |
| GET | `sale-agreements/:id/payment-certificate` | acheteur | Attestation PDF |

## Écrans
- **Mobile, acheteur**
  - `property/[id]/sale-inquiry` : brancher réellement `createSaleInquiry` et envoyer budget, téléphone et financement (P0).
  - `sales/inquiries` : mes demandes.
  - `property/[id]/offer` : faire une offre, voir les contre-offres, accepter ou contre-proposer.
  - `sale/[id]` : compromis, signature, échéancier et paiement, étapes (timeline), documents, attestation.
- **Web, agent**
  - `/agent/sales` : pipeline kanban (Nouveau, Contacté, Visite, Offre, Gagné, Perdu) avec notes et prochaines actions.
  - `/agent/sales/offers/[id]` : fil de négociation.
  - `sale-agreements/[id]` : ajouter la signature, les étapes et les documents.
- **Web, owner**
  - `/owner/sales/[id]` : offres reçues (accepter, refuser, contre-proposer) et suivi des étapes.

## Critères d'acceptation
- Envoyer le formulaire mobile crée bien une `SaleInquiry` avec `budget` et `phone` en base (test e2e). Le gestionnaire est notifié en moins d'une minute.
- Une 2ᵉ demande ouverte sur le même bien renvoie 409 `INQUIRY_ALREADY_OPEN`.
- Un ADMIN de l'agence mandatée (pas seulement un AGENT de l'org du bien) voit la demande dans `managed`.
- Accepter une offre : bien `UNDER_OFFER`, autres offres ouvertes `REJECTED`, acheteurs notifiés.
- Une offre inférieure à `minSalePrice` ne peut pas être acceptée par l'agent (403) ; une approbation est requise.
- `complete()` avec une échéance non payée renvoie 409 `INSTALLMENTS_UNPAID`. Après succès, `listingStatus = SOLD` et le bien est absent de la recherche.
- `cancel()` remet `AVAILABLE` et génère un remboursement de l'acompte selon la clause.

## Priorité
- **P0** : branchement réel du formulaire mobile, champs budget et téléphone, statut SOLD ou AVAILABLE à la clôture ou à l'annulation, périmètre gestionnaire corrigé, notification de nouvelle demande.
- **P1** : offres et contre-offres, validation du propriétaire et approbation de prix, anti-doublon, signature du compromis, étapes et documents.
- **P2** : pipeline kanban, attestation de paiement, gestion du défaut de paiement et de la mise en demeure.
