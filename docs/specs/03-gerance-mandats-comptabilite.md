# 03 — Gérance : mandats, approbations et comptabilité propriétaire

## Objectif et rôles
Formaliser la relation propriétaire–agence :
- mandat négocié et accepté, avec commission ;
- approbations qui produisent réellement leurs effets ;
- comptabilité claire pour le propriétaire (encaissements, honoraires, dépenses, reversements, relevés).

Rôles : `OWNER`, `MANAGER`, `AGENT`, `PLATFORM_ADMIN` (consultation).

## État actuel (audit)
- `Mandate` : `status` ACTIVE ou REVOKED, `startDate`, `endDate?`, `assignedAgentId`. Il est actif dès la création par le propriétaire, sans acceptation de l'agence.
- Pas de type de mandat (gestion locative, vente, séjours), pas de commission, pas d'exclusivité, pas de document signé.
- `revokeMandate` existe dans le service, mais aucune route ne l'expose. Aucun `GET` ne liste les mandats du propriétaire.
- `MandateApproval` : `LEASE_SIGN`, `RENT_REDUCTION`, `MAJOR_REPAIR`.
  - `decideApproval` change le statut mais n'émet aucun événement et n'applique pas l'action.
  - `RENT_REDUCTION` n'a pas de flux de création.
  - Aucun type pour la vente (prix, offre).
- L'événement `MANDATE_ACTION_PENDING` est émis mais n'a pas de listener.
- Pas de page web « mandats » côté agent. `owner/mandate` liste les approbations.
- Pas de comptabilité : ni honoraires, ni dépenses, ni reversements, ni relevés.

## User stories
### Mandat
1. En tant que propriétaire, je propose un mandat à une agence. Je choisis le type (LOCATION_LONGUE, SEJOURS, VENTE, ou plusieurs), la durée, l'exclusivité, la commission et les seuils d'approbation.
2. En tant que gérant d'agence, j'accepte, je refuse, ou je contre-propose les conditions (commission, durée).
3. Le mandat accepté génère un PDF de mandat signé électroniquement par les deux parties (OTP de signature).
4. Je vois la liste de mes mandats (en cours, en attente, terminés) et l'historique de chacun.
5. En tant que propriétaire, je résilie un mandat avec préavis, ou immédiatement pour faute (avec motif).
6. En tant qu'agence, je renonce à un mandat avec préavis.
7. À l'échéance d'un mandat à durée déterminée, il est renouvelé tacitement sauf dénonciation 30 jours avant. Les deux parties sont notifiées à J-45 et J-30.
8. En tant que gérant, j'assigne ou je réassigne un agent (route existante) ; l'agent est notifié.

### Approbations
9. En tant qu'agent, je soumets au propriétaire :
   - une signature de bail (LEASE_SIGN) ;
   - une baisse de loyer (RENT_REDUCTION) ;
   - un gros travaux (MAJOR_REPAIR) ;
   - un prix de vente ou une offre (SALE_PRICE, SALE_OFFER_ACCEPT) ;
   - une dépense (EXPENSE).
10. En tant que propriétaire, j'approuve ou je refuse avec un commentaire. L'action est alors appliquée automatiquement : bail activé, loyer modifié, ticket débloqué, offre acceptée, dépense validée.
11. Une approbation non traitée expire après N jours (paramétrable par mandat, 7 par défaut), avec relances à J+2 et J+5.

### Comptabilité
12. En tant que propriétaire, je vois pour chaque bien et chaque période :
    - les loyers appelés et encaissés, et les impayés ;
    - les honoraires de l'agence et les dépenses (travaux, taxes) ;
    - le net à reverser et le déjà reversé.
13. Je télécharge un relevé de gérance mensuel PDF et un récapitulatif annuel pour mes déclarations.
14. En tant qu'agence, j'enregistre une dépense sur un bien (facture jointe). Au-delà du seuil, elle passe par une approbation EXPENSE.
15. En tant qu'agence, je vois mon chiffre d'honoraires par mandat et par période, et j'exporte en CSV.

## Règles métier
- **Statuts de mandat** : `PROPOSED` → `ACTIVE` | `DECLINED` | `COUNTERED` ; `ACTIVE` → `TERMINATING` (préavis) → `TERMINATED` ; `ACTIVE` → `EXPIRED`. `REVOKED` est conservé pour l'existant et migré vers `TERMINATED` avec `terminationReason = OWNER_REVOKED`.
- **Unicité** : un seul mandat ACTIVE par bien et par périmètre (`scope`). Un mandat exclusif bloque tout autre mandat sur le même scope.
- **Commission**
  - Gestion locative : `managementFeeRate`, en % des loyers encaissés (8 % par défaut, modifiable).
  - Mise en location : `lettingFee` (fixe ou en mois de loyer).
  - Vente : `saleCommissionRate`, en % du prix.
  - Séjours : `stayCommissionRate`, en % du montant hors frais.
  - Les honoraires sont calculés automatiquement à chaque validation de paiement alloué à un bien sous mandat (`LedgerEntry` de type FEE).
- **Seuils d'approbation, par mandat**
  - `repairApprovalThreshold` en XAF (remplace la seule règle de priorité) ;
  - `rentChangeRequiresApproval` (true par défaut) ;
  - `leaseSignRequiresApproval` (true par défaut) ;
  - `minSalePrice`.
- **Effets d'une approbation APPROVED**
  - `LEASE_SIGN` : le bail DRAFT passe en ACTIVE (04).
  - `RENT_REDUCTION` : `payload { leaseId, newMonthlyRent, effectiveFrom }`. Les échéances PENDING à partir de `effectiveFrom` sont recalculées et un avenant est généré (04).
  - `MAJOR_REPAIR` : le ticket est débloqué (`requiresOwnerApproval` levé, statut ASSIGNED possible, voir 09).
  - `SALE_PRICE` : le prix du bien est mis à jour.
  - `SALE_OFFER_ACCEPT` : l'offre passe en ACCEPTED (08).
  - `EXPENSE` : la dépense passe en APPROVED et est imputée.
- **Effets d'un refus REJECTED** : l'objet source repasse dans l'état antérieur, avec le motif visible par l'agent.
- **Événements** :
  - `MANDATE_PROPOSED`, `MANDATE_ACCEPTED`, `MANDATE_DECLINED`, `MANDATE_TERMINATED`, `MANDATE_EXPIRING` ;
  - `MANDATE_ACTION_PENDING` (handler à créer) et `MANDATE_ACTION_DECIDED`.
- **Fin de mandat**
  - Les baux en cours restent valides. Le bien bascule en gestion directe par le propriétaire (son org).
  - L'agent assigné perd l'accès à J+0 (fin de préavis).
- **Grand livre (`LedgerEntry`)** : écriture immuable par bien et par org propriétaire.
  - Types : `RENT_IN`, `DEPOSIT_IN`, `DEPOSIT_OUT`, `FEE`, `EXPENSE`, `PAYOUT`, `ADJUSTMENT`, `REFUND`.
  - Une correction se fait par écriture inverse, jamais par modification.
- **Solde à reverser** = Σ RENT_IN − Σ FEE − Σ EXPENSE(APPROVED) − Σ PAYOUT, par mandat. Les reversements eux-mêmes sont traités en 05.
- **Relevés** : PDF mensuel généré le 5 du mois (cron) pour chaque mandat actif et envoyé au propriétaire par push et e-mail ; régénération possible à la demande.

## Modèle de données
```prisma
enum MandateStatus { PROPOSED COUNTERED ACTIVE TERMINATING TERMINATED EXPIRED DECLINED REVOKED }
enum MandateScope { LONG_TERM_RENTAL SHORT_STAY SALE }
enum MandateActionType { LEASE_SIGN RENT_REDUCTION MAJOR_REPAIR SALE_PRICE SALE_OFFER_ACCEPT EXPENSE }
enum ApprovalStatus { PENDING APPROVED REJECTED EXPIRED CANCELLED }
enum LedgerEntryType { RENT_IN DEPOSIT_IN DEPOSIT_OUT FEE EXPENSE PAYOUT ADJUSTMENT REFUND STAY_IN SALE_IN }
enum ExpenseStatus { DRAFT PENDING_APPROVAL APPROVED REJECTED PAID }

model Mandate {
  // + champs
  scopes                     MandateScope[]
  exclusive                  Boolean   @default(false)
  managementFeeRate          Decimal?  // ex. 0.08
  lettingFee                 Decimal?
  lettingFeeMonths           Decimal?
  saleCommissionRate         Decimal?
  stayCommissionRate         Decimal?
  repairApprovalThreshold    Decimal?
  rentChangeRequiresApproval Boolean   @default(true)
  leaseSignRequiresApproval  Boolean   @default(true)
  minSalePrice               Decimal?
  approvalTtlDays            Int       @default(7)
  noticeDays                 Int       @default(30)
  tacitRenewal               Boolean   @default(true)
  proposedById               String
  acceptedById               String?
  acceptedAt                 DateTime?
  terminationRequestedAt     DateTime?
  terminationEffectiveAt     DateTime?
  terminationReason          String?
  terminatedById             String?
  signedDocumentKey          String?
  ownerSignedAt              DateTime?
  agencySignedAt             DateTime?
  versions                   MandateVersion[]
}

model MandateVersion {
  id         String   @id @default(cuid())
  mandateId  String
  terms      Json     // snapshot des conditions proposées
  proposedBy String
  createdAt  DateTime @default(now())
}

model MandateApproval {
  // + champs
  requestedById String
  sourceType    String?   // LEASE | MAINTENANCE_TICKET | SALE_OFFER | EXPENSE | PROPERTY
  sourceId      String?
  comment       String?
  expiresAt     DateTime
  appliedAt     DateTime?
}

model Expense {
  id          String        @id @default(cuid())
  propertyId  String
  mandateId   String?
  ticketId    String?
  category    String        // REPAIR | TAX | INSURANCE | UTILITIES | OTHER
  label       String
  amount      Decimal
  currency    String
  invoiceKey  String?
  status      ExpenseStatus @default(DRAFT)
  createdById String
  incurredAt  DateTime
  createdAt   DateTime      @default(now())
}

model LedgerEntry {
  id             String          @id @default(cuid())
  propertyId     String
  mandateId      String?
  ownerOrgId     String
  agencyOrgId    String?
  type           LedgerEntryType
  amount         Decimal         // signé : + crédit propriétaire / − débit
  currency       String
  sourceType     String          // PAYMENT | EXPENSE | PAYOUT | REFUND | MANUAL
  sourceId       String
  reversesId     String?
  label          String
  occurredAt     DateTime
  createdAt      DateTime        @default(now())
  @@index([ownerOrgId, occurredAt])
  @@index([mandateId, occurredAt])
}

model OwnerStatement {
  id          String   @id @default(cuid())
  mandateId   String?
  ownerOrgId  String
  periodStart DateTime
  periodEnd   DateTime
  totals      Json
  fileKey     String
  generatedAt DateTime @default(now())
}
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `mandates` | OWNER | **Modifié** : crée en PROPOSED avec conditions |
| GET | `mandates/mine` | OWNER | Mandats de mes biens |
| GET | `mandates/managed` | MANAGER/AGENT | Existant ; ajouter filtres `status`, `scope`, pagination |
| GET | `mandates/:id` | parties | Détail, versions, approbations |
| POST | `mandates/:id/accept` | MANAGER | Accepte la dernière version |
| POST | `mandates/:id/decline` | MANAGER | `{ reason }` |
| POST | `mandates/:id/counter` | MANAGER/OWNER | Nouvelle version des conditions |
| POST | `mandates/:id/sign` | parties | Signature OTP (`{ code }`) |
| POST | `mandates/:id/terminate` | OWNER/MANAGER | `{ reason, immediate? }` : préavis ou fin immédiate pour faute |
| PATCH | `mandates/:id/assign` | MANAGER | Existant ; ajouter la notification |
| POST | `mandates/:id/approvals` | AGENT/MANAGER | `{ actionType, sourceType, sourceId, payload }` |
| GET | `mandates/pending-approvals` | OWNER | Existant ; ajouter la pagination |
| PATCH | `mandates/approvals/:id` | OWNER | **Modifié** : `{ decision, comment }` ; applique l'effet de manière transactionnelle |
| DELETE | `mandates/approvals/:id` | demandeur | Annule une demande PENDING |
| POST | `properties/:id/expenses` | MANAGER/AGENT/OWNER | Crée une dépense (+ facture) |
| GET | `properties/:id/expenses` | parties | Liste |
| PATCH | `expenses/:id` | créateur | Modifie un DRAFT, soumet |
| GET | `accounting/owner/summary` | OWNER | `?from&to&propertyId` : totaux par type |
| GET | `accounting/owner/ledger` | OWNER | Écritures paginées |
| GET | `accounting/owner/statements` | OWNER | Relevés |
| POST | `accounting/owner/statements` | OWNER | Génère un relevé `{ mandateId?, periodStart, periodEnd }` |
| GET | `accounting/agency/fees` | MANAGER | Honoraires par mandat et période |
| GET | `accounting/export.csv` | OWNER/MANAGER | Export CSV du ledger |

## Écrans
- **Web, owner**
  - `/owner/mandate` : remplacer la seule liste d'approbations par des onglets « Mandats » (cartes : statut, agence, scope, commission) et « Approbations » (avec effet prévisualisé : « Le loyer passera de 150 000 à 130 000 XAF à partir du 01/11 »).
  - `/owner/mandate/[id]` : conditions, versions, PDF, résiliation.
  - `/owner/mandate/add` : ajouter la sélection de l'agence (recherche par zone), les scopes, la commission et les seuils.
  - `/owner/finances` (nouveau) : synthèse, ledger, relevés, export.
- **Web, agent**
  - `/agent/mandates` (nouveau) : propositions reçues (accepter, refuser, contre-proposer), mandats actifs, assignation.
  - `/agent/mandates/[id]`.
  - `/agent/expenses`.
  - `/agent/finances` (ADMIN uniquement) : honoraires.
- **Mobile** (espace propriétaire, voir 14) : approbations avec push actionnable (Approuver / Refuser), relevés PDF.

## Critères d'acceptation
- Un mandat créé par le propriétaire est PROPOSED et ne donne aucun accès à l'agence avant `accept`.
- Deux mandats ACTIVE exclusifs sur le même bien et le même scope sont impossibles (409 `MANDATE_CONFLICT`).
- Approuver un `RENT_REDUCTION` met à jour `Lease.monthlyRent` et les `RentSchedule` PENDING concernées dans la même transaction, et crée un avenant (test).
- Approuver un `MAJOR_REPAIR` permet au ticket de passer en ASSIGNED. Avant approbation, la transition renvoie 409 `OWNER_APPROVAL_REQUIRED`.
- Chaque `MANDATE_ACTION_PENDING` produit une notification au propriétaire (11).
- Une approbation passe en EXPIRED après `approvalTtlDays`, et l'objet source revient à son état antérieur.
- Le paiement validé d'un loyer sous mandat à 8 % crée `RENT_IN +100 %` et `FEE −8 %` (test).
- La somme du ledger d'un mandat sur une période égale le « net » affiché dans le relevé PDF.
- Après `terminate`, l'agent assigné reçoit 403 sur le bien dès la date d'effet.

## Priorité
- **P0** : route de résiliation, effets réels des approbations, listener `MANDATE_ACTION_PENDING`, flux `RENT_REDUCTION`.
- **P1** : acceptation par l'agence, commissions, ledger, dépenses, relevés, pages mandats côté agent.
- **P2** : contre-proposition versionnée, signature électronique, renouvellement tacite, export CSV.
