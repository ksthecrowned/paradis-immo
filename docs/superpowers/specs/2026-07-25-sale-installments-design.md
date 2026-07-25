# Vente par paliers (SaleAgreement) — Design

> Statut : validé (brainstorming 25 juil. 2026). Phase Vente V3 / S0.
> Remplace le vague « historique portable acheteur » comme prochaine étape
> du fil paiements ; S4 (preuve acheteur) reste hors V3.

## Objectif

Permettre à un owner/agent d’ouvrir un **dossier vente** (bien + acheteur)
avec un **échéancier d’acomptes**, et à l’acheteur de suivre / payer chaque
palier — même moteur de paiement que le loyer (MoMo + validation manuelle).

## Décisions produit

| Question | Décision |
|----------|----------|
| Unité | Dossier = **bien + acheteur** (`SaleAgreement`) |
| Création | **Manuelle** (comme un bail) **ou** depuis une `SaleInquiry` |
| Paliers | Liste libre + aide UI « répartir le reste » ; Σ = prix convenu |
| Listing | À l’activation → `listingStatus = UNDER_OFFER` ; **pas** de `SOLD` auto |
| Concurrence | **Plusieurs** dossiers actifs possibles sur le même bien |
| Paiements | Réutilise `Payment` / allocations ; nouveau type `SALE_INSTALLMENT` |
| Miroir model | Comme `Lease` + `RentSchedule` |

## Parcours

1. Owner crée un dossier (formulaire) **ou** ouvre depuis une demande d’achat
   (prérempli : bien, acheteur).
2. Saisie : prix convenu, devise, N paliers (libellé?, montant, échéance).
   Bouton « Répartir le reste » ajuste le dernier palier pour coller au prix.
3. Statut initial `DRAFT` → **Activer** → `ACTIVE` + bien `UNDER_OFFER`
   (sauf si déjà `SOLD`).
4. Acheteur voit le dossier sur mobile ; paie un palier `PENDING` /
   `OVERDUE` ; owner peut aussi **valider manuellement**.
5. Owner peut **Compléter** (`COMPLETED`) ou **Annuler** (`CANCELLED`) ;
   `SOLD` marketplace reste une action manuelle séparée.

## Modèle de données

```prisma
enum SaleAgreementStatus {
  DRAFT
  ACTIVE
  COMPLETED
  CANCELLED
}

enum SaleInstallmentStatus {
  PENDING
  PAID
  OVERDUE
  PARTIAL
}

model SaleAgreement {
  id             String
  propertyId     String
  buyerId        String              // User
  organizationId String
  saleInquiryId  String?             @unique  // optional link
  agreedPrice    Decimal
  currency       String
  status         SaleAgreementStatus @default(DRAFT)
  installments   SaleInstallment[]
  activatedAt    DateTime?
  completedAt    DateTime?
  createdAt      DateTime
  updatedAt      DateTime
}

model SaleInstallment {
  id          String
  agreementId String
  label       String?
  dueDate     DateTime
  amount      Decimal
  currency    String
  status      SaleInstallmentStatus @default(PENDING)
  position    Int
  // allocations via PaymentAllocation.refId + type SALE_INSTALLMENT
  createdAt   DateTime
}
```

Étendre `AllocatableType` avec `SALE_INSTALLMENT`.

### Règles

- Bien doit être `mode = SALE` ; manager doit pouvoir opérer le bien
  (`AgencyAccessService`).
- Acheteur : `UsersService.resolveOrCreateByPhone` (nom requis à la création).
- ≥ 1 palier ; somme des montants = `agreedPrice` (tolérance 0 ; montants
  en centimes/entier XAF).
- Édition structurelle des paliers : **DRAFT** uniquement. Une fois `ACTIVE`,
  montants/dates gelés ; seuls statut / paiements évoluent. (V3.1 éventuel :
  avenant.)
- `OVERDUE` : lazy à la lecture ou job existant rent-reminder étendu (V3 :
  lazy à la lecture suffit).

## API

### Owner / agent

- `POST /api/v1/sale-agreements` — body : propertyId, buyer phone/name,
  agreedPrice, currency, installments[], saleInquiryId?
- `GET /api/v1/sale-agreements` — liste dossiers gérés
- `GET /api/v1/sale-agreements/:id`
- `PATCH /api/v1/sale-agreements/:id` — DRAFT only (prix / paliers)
- `POST /api/v1/sale-agreements/:id/activate`
- `POST /api/v1/sale-agreements/:id/complete`
- `POST /api/v1/sale-agreements/:id/cancel`
- Paiement : réutiliser `POST /payments/...` / `validate` avec allocation
  `SALE_INSTALLMENT`

### Acheteur

- `GET /api/v1/me/sale-agreements`
- `GET /api/v1/me/sale-agreements/:id`
- Init paiement palier (même pattern que loyer / rent schedule)

### SaleInquiry

- Sur détail demande : action « Ouvrir un dossier » → POST agreement avec
  `saleInquiryId` + buyer = inquiry.userId ; inquiry → statut adapté
  (ex. `CLOSED` ou garder `CONTACTED` — **V3 : passer inquiry en `CLOSED`
  à l’activation du dossier lié**).

## Clients

### Web owner/agent

- Nav : « Dossiers vente » (owner + agent ; à côté des demandes agent).
- Formulaire : lignes paliers dynamiques + « Répartir le reste ».
- Détail : tableau paliers, badges statut, Valider paiement.
- CTA depuis liste / détail `SaleInquiry`.

### Mobile acheteur

- Entrée « Mes achats » (ou depuis hub existant).
- Détail dossier + carte prochain palier + CTA payer (flux paiement existant).

### Notifications (V3 minimal)

- À la validation d’un palier → notif acheteur (pattern `PAYMENT_VALIDATED`).
- Reminders due/overdue : nice-to-have V3.1.

## Hors scope V3

- `SOLD` automatique.
- Templates de plan sur le bien seul.
- Preuve / solvabilité acheteur portable (S4).
- Avenants après premier paiement.
- Multi-devises exotiques (rester sur devise du bien / XAF).

## Tests (API)

- Create manuel OK ; create depuis inquiry OK.
- Σ paliers ≠ prix → 400 `INSTALLMENTS_SUM_MISMATCH`.
- Activate → status ACTIVE + property `UNDER_OFFER`.
- Deux ACTIVE sur même bien → OK.
- Validate payment on installment → `PAID`.
- Buyer `me` list ; stranger → 403.
- PATCH after ACTIVE → 400.
- Cancel / complete transitions.

## Roadmap TODOS

S0 ✅ (cette spec) → S1 config owner → S2 paiements → S3 mobile acheteur ;
S4 plus tard.
