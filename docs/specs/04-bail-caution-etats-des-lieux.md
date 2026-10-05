# 04 — Location longue durée : candidature, bail, caution, états des lieux, quittances

## Objectif et rôles
Couvrir tout le cycle de la location longue durée :
1. candidature ;
2. contrôle de solvabilité ;
3. bail signé ;
4. caution ;
5. état des lieux d'entrée ;
6. loyers et quittances ;
7. révisions et avenants ;
8. préavis ;
9. état des lieux de sortie ;
10. restitution de la caution ;
11. clôture.

Rôles : `SEEKER` (candidat), `TENANT`, `OWNER`, `MANAGER`, `AGENT`.

## État actuel (audit)
- `Lease` : statuts DRAFT, ACTIVE, TERMINATED, mais aucun passage à TERMINATED. Pas de résiliation, de préavis ni de renouvellement.
- L'activation ne vérifie pas les chevauchements de baux sur le bien et ne passe pas le bien en `OCCUPIED`.
- Le locataire est créé automatiquement à partir de son téléphone, sans invitation ni notification (`LEASE_CREATED` n'a pas de listener).
- `deposit` est un simple nombre : ni encaissement, ni retenue, ni restitution.
- `RentSchedule` est généré à l'activation. `PARTIAL` existe, sans logique d'allocation partielle visible côté UI.
- Pas de charges, de révision annuelle, de pénalités de retard, d'avenant structuré (seul `LeaseDocument AMENDMENT` existe sous forme de fichier), ni d'état des lieux.
- Solvabilité : on ne peut l'interroger que pour un locataire existant d'un bien géré, jamais pour un candidat.
- Reçu : numéro `REC-xxxx-base36` non séquentiel, pas de quittance de loyer mensuelle, informations du bailleur absentes.
- `listManaged` est limité à 50, sans pagination.

## User stories
### Candidature
1. En tant que chercheur, je postule sur une annonce `RENT_LONG` : date d'emménagement souhaitée, nombre d'occupants, profession, revenus déclarés, pièces jointes (identité, justificatifs). Les pièces sont réutilisables d'une candidature à l'autre (dossier locataire).
2. En tant que gestionnaire, je vois les candidatures d'un bien. Je demande un contrôle de solvabilité au candidat ; il donne ou refuse son consentement depuis l'app.
3. J'accepte une candidature, ce qui pré-remplit un bail DRAFT. Les autres candidatures sont alors refusées automatiquement, avec un message personnalisable.

### Bail
4. Je crée le bail : dates, loyer, charges (forfait ou provision), caution, jour d'échéance, mode de paiement, clause de révision, pénalité de retard. J'utilise un modèle de contrat de l'agence.
5. Le locataire reçoit une invitation (SMS, push et lien), consulte le bail et le signe par OTP. Le propriétaire ou l'agent signe ensuite, après approbation `LEASE_SIGN` si le mandat l'exige (03).
6. À l'activation : le bien passe en `OCCUPIED`, les échéances sont générées et l'annonce est retirée de la recherche.
7. En tant que gestionnaire, je fais un avenant (loyer, charges, durée, colocataire). Il est versionné et signé, et les échéances futures sont recalculées.
8. La révision annuelle du loyer est proposée automatiquement à la date anniversaire, selon le taux défini au bail, et nécessite une validation.
9. En tant que locataire ou bailleur, je donne congé : préavis (durée selon le bail : 3 mois locataire, 6 mois bailleur par défaut), motif, date de sortie souhaitée. L'autre partie est notifiée.
10. Le bail se termine : `TERMINATING` pendant le préavis, puis `TERMINATED` après l'EDL de sortie. Le bien repasse en `AVAILABLE` ou `AVAILABLE_SOON`, selon la date.
11. À l'échéance d'un bail à durée déterminée, il est renouvelé (tacitement ou par proposition), avec notifications à J-90 et J-30.

### Caution
12. La caution est appelée comme une échéance spéciale (`RentSchedule.kind = DEPOSIT`) et payée par mobile money ou en espèces validées.
13. À la sortie, le gestionnaire saisit les retenues (ligne, montant, justificatif ou photo de l'EDL). Le locataire peut les contester sous 15 jours. La restitution se fait ensuite (reversement, voir 05).

### États des lieux
14. Le gestionnaire réalise l'EDL d'entrée sur mobile ou web, pièce par pièce : élément, état (Neuf, Bon, Usé, Dégradé), commentaire, photos. Il relève les compteurs (eau, électricité) et les clés remises.
15. Le locataire signe l'EDL (OTP) et peut ajouter des réserves sous 10 jours.
16. L'EDL de sortie reprend la structure de l'entrée et affiche un comparatif automatique : les écarts deviennent des propositions de retenue.

### Loyers, quittances, impayés
17. Chaque échéance totalement payée génère une quittance mensuelle PDF : numéro séquentiel, période, montant loyer et charges, bailleur, agence, locataire, adresse.
18. Un paiement partiel laisse l'échéance `PARTIAL`, avec le reste dû affiché. La quittance n'est émise qu'au solde ; un reçu de paiement est émis pour chaque versement.
19. Une pénalité de retard optionnelle (fixe ou en %) s'ajoute après N jours. Le gestionnaire peut l'annuler.
20. Le gestionnaire voit un tableau des impayés (ancienneté 0-30, 31-60, plus de 60 jours) et envoie une relance manuelle. Une mise en demeure PDF est générée après 15 jours.
21. Le locataire voit dans l'app son solde, son historique et ses quittances, puis paie l'échéance en un tap.

## Règles métier
- **Statuts du bail** : `DRAFT` → `PENDING_SIGNATURE` → `ACTIVE` → `TERMINATING` → `TERMINATED`, plus `CANCELLED` depuis DRAFT ou PENDING_SIGNATURE.
- **Chevauchement** : on ne peut pas activer un bail si un autre bail ACTIVE ou TERMINATING couvre la période sur le même bien, ni s'il existe un séjour CONFIRMED qui chevauche. Le contrôle est fait en transaction.
- **Locataire inconnu** : le bail référence un `invitedPhone` tant que le compte n'a pas accepté l'invitation. On ne crée plus de `User` silencieusement.
- **Échéances**
  - générées à l'activation, de `startDate` à `endDate` (ou 12 mois glissants si durée indéterminée, prolongées par cron) ;
  - `dueDay` configurable ;
  - premier mois au prorata, option activée par défaut.
- **Allocation des paiements** : un paiement est d'abord alloué à la pénalité, puis aux charges, puis au loyer, de l'échéance la plus ancienne à la plus récente, sauf si le locataire désigne une échéance.
- **Charges** : la provision est appelée chaque mois. Une régularisation annuelle optionnelle crée une ligne ADJUSTMENT.
- **Révision** : nouveau loyer = loyer × (1 + `indexationRate`), appliqué après validation (approbation `RENT_REDUCTION` ou `RENT_INCREASE`, voir 03).
- **Préavis** : la date d'effet est au minimum la date de notification + `noticeMonths`. Les échéances au-delà de la date de sortie sont annulées (`CANCELLED`).
- **Caution**
  - Le montant est plafonné par paramètre pays (par défaut 3 mois de loyer, configurable dans 12).
  - Elle est conservée dans le ledger (`DEPOSIT_IN`).
  - La restitution (`DEPOSIT_OUT`) intervient au plus tard 30 jours après l'EDL de sortie ; une alerte est envoyée au gestionnaire à J+25.
- **EDL**
  - Immutable une fois signé par les deux parties. Les réserves s'ajoutent en annexe.
  - Photos : 20 au plus par pièce, horodatées.
- **Quittance**
  - Numérotation séquentielle par org émettrice : `Q-{ORG}-{AAAA}-{000001}`.
  - Même règle pour les reçus de paiement : `R-{ORG}-{AAAA}-{000001}`, en remplacement de `REC-xxxx-base36`.
- **Solvabilité candidat** : `SolvencyCheck` peut viser un `applicationId` (et non plus seulement un locataire existant), avec le même consentement et la même expiration.

## Modèle de données
```prisma
enum LeaseStatus { DRAFT PENDING_SIGNATURE ACTIVE TERMINATING TERMINATED CANCELLED }
enum RentScheduleStatus { PENDING PAID OVERDUE PARTIAL CANCELLED WAIVED }
enum RentScheduleKind { RENT DEPOSIT CHARGES_ADJUSTMENT LATE_FEE }
enum ApplicationStatus { SUBMITTED UNDER_REVIEW SOLVENCY_PENDING ACCEPTED REJECTED WITHDRAWN }
enum InspectionType { CHECK_IN CHECK_OUT }
enum ItemCondition { NEW GOOD WORN DAMAGED MISSING }
enum DepositDeductionStatus { PROPOSED CONTESTED ACCEPTED }
enum TerminationInitiator { TENANT LANDLORD MUTUAL }

model RentalApplication {
  id               String            @id @default(cuid())
  propertyId       String
  applicantId      String
  desiredMoveIn    DateTime
  occupants        Int
  occupation       String?
  declaredIncome   Decimal?
  message          String?
  status           ApplicationStatus @default(SUBMITTED)
  rejectionMessage String?
  decidedById      String?
  decidedAt        DateTime?
  leaseId          String?           @unique
  createdAt        DateTime          @default(now())
  @@unique([propertyId, applicantId])
}

model Lease {
  // + champs
  invitedPhone         String?
  dueDay               Int      @default(5)
  chargesAmount        Decimal  @default(0)
  chargesMode          String   @default("FLAT") // FLAT | PROVISION
  noticeMonthsTenant   Int      @default(3)
  noticeMonthsLandlord Int      @default(6)
  indexationRate       Decimal?
  lateFeeAfterDays     Int?
  lateFeeAmount        Decimal?
  lateFeeRate          Decimal?
  autoRenew            Boolean  @default(true)
  templateId           String?
  tenantSignedAt       DateTime?
  landlordSignedAt     DateTime?
  landlordSignedById   String?
  activatedAt          DateTime?
  terminationInitiator TerminationInitiator?
  terminationNoticeAt  DateTime?
  terminationEffectiveAt DateTime?
  terminationReason    String?
  terminatedAt         DateTime?
  coTenants            LeaseTenant[]
  amendments           LeaseAmendment[]
  inspections          Inspection[]
}

model LeaseTenant { leaseId String userId String isPrimary Boolean @default(false) @@id([leaseId, userId]) }

model LeaseAmendment {
  id            String   @id @default(cuid())
  leaseId       String
  version       Int
  changes       Json     // { monthlyRent?, chargesAmount?, endDate?, coTenants? }
  effectiveFrom DateTime
  reason        String?
  documentKey   String?
  tenantSignedAt   DateTime?
  landlordSignedAt DateTime?
  createdById   String
  createdAt     DateTime @default(now())
  @@unique([leaseId, version])
}

model LeaseTemplate {
  id             String @id @default(cuid())
  organizationId String
  name           String
  body           String  // markdown avec variables {{tenant.name}}, {{lease.monthlyRent}}…
  isDefault      Boolean @default(false)
}

model RentSchedule {
  // + champs
  kind       RentScheduleKind @default(RENT)
  rentPart   Decimal
  chargesPart Decimal @default(0)
  lateFee    Decimal @default(0)
  amountPaid Decimal @default(0)
  periodStart DateTime?
  periodEnd   DateTime?
  rentReceiptId String?
}

model RentReceipt {        // quittance
  id          String   @id @default(cuid())
  number      String   @unique
  rentScheduleId String @unique
  issuerOrgId String
  fileKey     String
  issuedAt    DateTime @default(now())
}

model DocumentSequence { organizationId String kind String year Int last Int @@id([organizationId, kind, year]) }

model Inspection {
  id          String         @id @default(cuid())
  leaseId     String
  type        InspectionType
  performedById String
  performedAt DateTime
  meters      Json?          // { water, electricity }
  keys        Json?          // [{ label, count }]
  generalComment String?
  tenantSignedAt   DateTime?
  managerSignedAt  DateTime?
  reservesUntil DateTime?
  documentKey String?
  rooms       InspectionRoom[]
  @@unique([leaseId, type])
}

model InspectionRoom { id String @id @default(cuid()) inspectionId String name String position Int items InspectionItem[] }

model InspectionItem {
  id        String        @id @default(cuid())
  roomId    String
  label     String
  condition ItemCondition
  comment   String?
  photoKeys String[]
}

model InspectionReserve { id String @id @default(cuid()) inspectionId String authorId String text String photoKeys String[] createdAt DateTime @default(now()) }

model DepositDeduction {
  id         String                 @id @default(cuid())
  leaseId    String
  label      String
  amount     Decimal
  evidenceItemId String?
  evidenceKeys String[]
  status     DepositDeductionStatus @default(PROPOSED)
  tenantComment String?
  createdAt  DateTime               @default(now())
}

model DepositSettlement {
  id          String   @id @default(cuid())
  leaseId     String   @unique
  heldAmount  Decimal
  deducted    Decimal
  refundAmount Decimal
  contestUntil DateTime
  payoutId    String?
  settledAt   DateTime?
}
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `properties/:id/applications` | SEEKER | Postuler |
| GET | `applications/mine` | SEEKER | Mes candidatures |
| DELETE | `applications/:id` | candidat | Retirer |
| GET | `properties/:id/applications` | gestionnaire | Liste paginée |
| PATCH | `applications/:id` | gestionnaire | `{ status, rejectionMessage? }` |
| POST | `applications/:id/solvency-checks` | gestionnaire | Demande de solvabilité au candidat |
| POST | `applications/:id/lease` | gestionnaire | Crée un bail DRAFT pré-rempli |
| GET | `users/me/tenant-file` | auth | Dossier locataire réutilisable |
| POST | `leases` | gestionnaire | **Modifié** : `invitedPhone` plutôt que création silencieuse d'un user |
| GET | `leases/managed` | gestionnaire | **Modifié** : pagination et filtres `status`, `propertyId`, `overdue` |
| POST | `leases/:id/send-for-signature` | gestionnaire | DRAFT → PENDING_SIGNATURE, invitation au locataire |
| POST | `leases/:id/sign` | locataire / bailleur | `{ otpCode }` |
| POST | `leases/:id/cancel` | gestionnaire | Annule un DRAFT ou PENDING_SIGNATURE |
| POST | `leases/:id/amendments` | gestionnaire | Crée un avenant (passe par approbation si mandat) |
| POST | `leases/:id/amendments/:v/sign` | parties | Signature |
| POST | `leases/:id/termination` | locataire / bailleur | `{ initiator, reason, requestedEndDate }` |
| DELETE | `leases/:id/termination` | initiateur | Retire le congé pendant le préavis (si l'autre partie accepte) |
| POST | `leases/:id/renew` | gestionnaire | Nouveau terme et nouveau loyer |
| GET | `leases/:id/balance` | parties | Solde, échéances, pénalités |
| POST | `rent-schedules/:id/waive-fee` | gestionnaire | Annule une pénalité |
| GET | `rent-schedules/:id/receipt` | parties | Quittance PDF (URL signée) |
| GET | `leases/:id/receipts` | parties | Toutes les quittances |
| GET | `leases/arrears` | gestionnaire | Tableau des impayés par ancienneté |
| POST | `leases/:id/reminders` | gestionnaire | Relance manuelle (canal au choix) |
| POST | `leases/:id/formal-notice` | gestionnaire | Génère une mise en demeure PDF |
| POST | `leases/:id/inspections` | gestionnaire | Crée un EDL `{ type }` |
| PUT | `inspections/:id` | gestionnaire | Pièces, éléments, compteurs (brouillon) |
| POST | `inspections/:id/photos` | gestionnaire | Upload (presign R2) |
| POST | `inspections/:id/sign` | parties | Signature OTP |
| POST | `inspections/:id/reserves` | locataire | Réserves avant `reservesUntil` |
| GET | `inspections/:id/compare` | parties | Comparatif entrée/sortie |
| GET | `inspections/:id/pdf` | parties | PDF |
| POST | `leases/:id/deposit/deductions` | gestionnaire | Proposer une retenue |
| PATCH | `deposit-deductions/:id` | locataire | `{ status: CONTESTED, tenantComment }` |
| POST | `leases/:id/deposit/settle` | gestionnaire | Clôture et création du reversement (05) |
| CRUD | `organizations/:id/lease-templates` | ADMIN org | Modèles de bail |

## Écrans
- **Web, owner et agent**
  - `leases/[id]` : onglets Contrat, Échéances (avec solde), Quittances, Avenants, EDL, Caution, Documents (existant), Congé.
  - `leases/add` : sélection de candidature, modèle, charges, pénalités, révision.
  - `/agent/applications` et `/owner/applications` : liste par bien, comparateur de candidats, demande de solvabilité.
  - `/agent/arrears` et `/owner/arrears` : impayés.
  - `/agent/inspections/[id]` : saisie de l'EDL (éditeur pièce par pièce, également utilisable sur tablette).
  - `/agent/settings/lease-templates`.
- **Mobile, locataire**
  - `lease/[id]` : contrat PDF, signature, solde, payer, quittances, congé, EDL et réserves, caution et contestation.
  - `property/[id]/apply` : candidature.
  - `profile/tenant-file` : dossier locataire.
- **Mobile, gestionnaire** (14) : réalisation de l'EDL hors ligne avec appareil photo, puis synchronisation.

## Critères d'acceptation
- Activer un 2ᵉ bail qui chevauche un bail ACTIVE renvoie 409 `LEASE_OVERLAP`.
- À l'activation, `Property.listingStatus = OCCUPIED` et l'annonce disparaît de `GET properties` en mode RENT_LONG.
- Créer un bail pour un numéro inconnu n'insère aucun `User`. L'invitation SMS est envoyée et le bail reste PENDING_SIGNATURE.
- Un paiement de 100 000 sur une échéance de 150 000 laisse l'échéance `PARTIAL` avec `amountPaid = 100000`, émet un reçu de paiement et aucune quittance.
- Les numéros de quittance d'une org sont strictement consécutifs sur l'année, y compris en cas de concurrence (séquence verrouillée).
- Un congé locataire le 15/01 avec 3 mois de préavis donne une date d'effet au plus tôt le 15/04. Les échéances postérieures sont `CANCELLED`.
- L'EDL signé n'est plus modifiable (409). Les réserves après `reservesUntil` renvoient 409.
- La restitution de caution = caution − retenues ACCEPTED, et génère `DEPOSIT_OUT` dans le ledger.
- `LEASE_CREATED` déclenche une notification au locataire (11).

## Priorité
- **P0** : chevauchement, statut du bien, résiliation et clôture (`TERMINATED`), invitation au lieu de la création silencieuse, pagination.
- **P1** : candidature et solvabilité du candidat, signature, quittances séquentielles, paiements partiels, caution (encaissement et restitution), EDL, impayés.
- **P2** : avenants versionnés, révision annuelle, pénalités, modèles de bail, colocation, mise en demeure.
