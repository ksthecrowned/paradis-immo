# Preuve de paiements acheteur (BuyerPaymentProof) — Design

> Statut : validé (brainstorming 3 sept. 2026). Phase Vente V3 / S4.
> Miroir de la V2 locative (`SolvencyCheck`), ancré sur un dossier vente.

## Objectif

Permettre au **vendeur** (owner/agent) d’un **dossier vente** (`SaleAgreement`)
de vérifier la fiabilité d’un acheteur déjà connu sur Paradis Immo, en lui
demandant l’accès aux **3 derniers paiements `PAID`** (loyers **et** paliers
de vente, mélangés). L’acheteur **valide** explicitement ; l’accès expire
après **7 jours**.

Ce n’est **pas** un dossier portable ni un score : uniquement un snapshot
consenté, sans nom de bien / quartier.

## Décisions produit

| Question | Décision |
|----------|----------|
| Besoin | Miroir V2 (demande + consentement + expiration) |
| Contenu | Mélange loyers + paliers (top 3 `PAID` par `dueDate` desc) |
| Libellé type | `LOYER` / `PALIER` côté UI · `RENT` / `SALE_INSTALLMENT` en JSON |
| Qui initie | Owner/agent depuis un **`SaleAgreement`** (pas hors dossier) |
| Qui valide | L’acheteur (`buyerUserId`) |
| Volume | **3** derniers |
| Durée d’accès | **7 jours** après acceptation |
| Snapshot | Figé à l’acceptation |
| Modèle | Nouvelle entité `BuyerPaymentProof` (pas de fusion avec `SolvencyCheck`) |

## Parcours

1. Owner/agent ouvre le détail d’un `SaleAgreement` → « Demander la preuve
   de paiements ».
2. Prérequis accès : le manager peut opérer le `SaleAgreement` (même règle
   que `GET /sale-agreements/:id`) ; statut dossier ≠ `CANCELLED`.
3. Prérequis données : au moins **1** paiement `PAID` pour ce `buyerUserId`
   (via `RentSchedule` sur baux où `tenantId = buyer`, **ou**
   `SaleInstallment` sur agreements où `buyerId = buyer`, y compris le
   dossier courant). Sinon bouton désactivé + message d’aide.
4. Création d’un `BuyerPaymentProof` en `PENDING` + notification mobile
   à l’acheteur.
5. Acheteur voit qui demande (organisation) → Accepter / Refuser.
6. Sur **Accepter** : calcul du snapshot (top 3 `PAID` tous types, tri
   `dueDate` desc), `status = GRANTED`, `expiresAt = now + 7 jours`.
7. Sur **Refuser** : `status = DENIED`.
8. Owner recharge le dossier → bloc Preuve selon l’état. Après
   `expiresAt`, lecture → `EXPIRED` (lazy à la lecture).

## Modèle de données

```prisma
enum BuyerPaymentProofStatus {
  PENDING
  GRANTED
  DENIED
  EXPIRED
}

model BuyerPaymentProof {
  id              String                   @id @default(uuid())
  saleAgreementId String
  saleAgreement   SaleAgreement            @relation(...)
  buyerUserId     String
  buyer           User                     @relation(...)
  requesterUserId String
  requesterOrgId  String
  organization    Organization             @relation(...)
  status          BuyerPaymentProofStatus  @default(PENDING)
  snapshot        Json?                    // figé à l’acceptation
  respondedAt     DateTime?
  expiresAt       DateTime?
  createdAt       DateTime                 @default(now())
  updatedAt       DateTime                 @updatedAt

  @@index([saleAgreementId, status])
  @@index([buyerUserId, status])
}
```

### Forme du `snapshot`

```json
[
  {
    "kind": "RENT",
    "dueDate": "2026-04-01",
    "paidAt": "2026-04-03",
    "amount": 150000,
    "currency": "XAF",
    "daysLate": 2
  },
  {
    "kind": "SALE_INSTALLMENT",
    "dueDate": "2026-03-15",
    "paidAt": "2026-03-14",
    "amount": 500000,
    "currency": "XAF",
    "daysLate": 0
  }
]
```

- `paidAt` : date du paiement validé lié ; si indisponible, fallback
  `updatedAt` de l’échéance `PAID` (même règle que V2).
- `daysLate = max(0, calendarDays(paidAt − dueDate))`.
- **Interdit** dans le snapshot : `propertyId`, titre, adresse, quartier,
  `saleAgreementId` des paliers sources.

### Règles d’unicité

- Au plus **un** `PENDING` par `saleAgreementId`.
- Une nouvelle demande est autorisée si le précédent est `GRANTED` /
  `DENIED` / `EXPIRED` (sinon 409 `PENDING_EXISTS`).

## API

### Owner / agent (auth + droit d’opérer le dossier / bien)

- `POST /api/v1/sale-agreements/:id/payment-proofs`  
  → `{ id, status: PENDING, ... }`  
  Erreurs : `NO_PAID_PAYMENTS` (400), `PENDING_EXISTS` (409),
  `FORBIDDEN` (403), `AGREEMENT_CANCELLED` (400).

- `GET /api/v1/sale-agreements/:id/payment-proofs/latest`  
  → dernier proof de **ce dossier** ; si `GRANTED` et `expiresAt < now`
  → passer en `EXPIRED` avant réponse ; **ne pas** renvoyer `snapshot`
  si non `GRANTED` (ou si expiré).

### Acheteur (auth = lui-même)

- `GET /api/v1/me/buyer-payment-proofs` — liste (PENDING en tête).
- `POST /api/v1/me/buyer-payment-proofs/:id/respond` body `{ accept: boolean }`  
  → met à jour statut + snapshot si accept.

## Clients

### Web owner/agent — détail dossier vente

Bloc **Preuve de paiements** :

| État | UI |
|------|-----|
| Aucun / EXPIRED / DENIED | Bouton « Demander la preuve de paiements » |
| PENDING | « En attente de la réponse de l’acheteur » |
| GRANTED (valide) | Tableau des 3 lignes (type · échéance · montant · retard) + « Expire le … » |
| 0 paiement PAID | Bouton désactivé + texte d’aide |

### Mobile acheteur

- Entrée depuis **Mes achats** (badge si PENDING) et/ou liste des demandes.
- Écran demande : nom de l’organisation + texte d’explication + Accepter /
  Refuser.
- Pas d’affichage du détail des montants côté acheteur avant accept ;
  après accept, confirmation simple.

### Notifications

- À la création : notif acheteur `BUYER_PAYMENT_PROOF_REQUESTED`.
- Pas obligatoire de notif owner sur réponse (refresh dossier suffit).

## Droits

- Demande / lecture owner : même garde-fou que l’accès au `SaleAgreement`
  (manager du bien / org via `AgencyAccessService`).
- Réponse : uniquement `buyerUserId === currentUser`.
- `buyerUserId` doit être le `buyerId` du `SaleAgreement` ciblé.

## Hors scope

- Historique portable riche / consentement multi-périodes.
- Nom du bien précédent, score de régularité.
- Preuve hors dossier vente (recherche téléphone libre).
- Fusion avec `SolvencyCheck`.
- Reçus PDF « portables » hors flux receipt existant.
- Job cron d’expiration (lazy à la lecture suffit).

## Tests (API)

- Demande OK → PENDING + notif émise (mock events).
- Demande avec 0 `PAID` → 400 `NO_PAID_PAYMENTS`.
- Second PENDING même agreement → 409.
- Accept → snapshot ≤ 3, kinds mixtes possibles, `expiresAt` ≈ +7j,
  owner voit snapshot.
- Deny → owner ne voit pas snapshot.
- Après `expiresAt` → lecture latest marque EXPIRED, snapshot masqué.
- Stranger / non-manager → 403.

## Roadmap TODOS

Dans `TODOS.md`, S4 passe de « plus tard » à focus actif après plan :
S4.0 spec ✅ → S4.1 API → S4.2 mobile acheteur → S4.3 web dossier vente.
