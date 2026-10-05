# 09 — Maintenance et interventions

## Objectif et rôles
Gérer les demandes d'intervention, du signalement par le locataire jusqu'à la facture et l'imputation comptable : prestataires, devis, approbation du propriétaire, suivi, et maintenance préventive.
Rôles : `TENANT` (déclarant), `AGENT` et `MANAGER`, `OWNER`, `PROVIDER` (nouveau : artisan ou prestataire externe).

## État actuel (audit)
- `MaintenanceTicket`
  - Champs : title, description, priority (LOW, MEDIUM, HIGH, URGENT), status (OPEN, ASSIGNED, IN_PROGRESS, DONE, CLOSED), estimatedCost, requiresOwnerApproval, assigneeId.
  - `updateTicket` accepte n'importe quel statut : il n'y a **pas de machine à états**.
  - `assigneeId` peut désigner n'importe quel user : aucune notion de prestataire.
  - `computeRequiresOwnerApproval` (URGENT ou montant) crée une approbation MAJOR_REPAIR, mais celle-ci ne débloque rien (03).
- `createTicket` (controller et service) vérifie seulement que le bien existe. **N'importe quel utilisateur connecté peut ouvrir un ticket sur n'importe quel bien**, puisqu'aucun contrôle de bail n'est fait.
- `listForActor` est basé sur l'org et non sur le mandat.
- Pas de commentaires, de photos, de coût réel, de facture, de catégorie, de créneau d'intervention ni de satisfaction.
- `MAINTENANCE_OPENED` est émis sans listener.
- Web : liste, détail, ajout et édition côté owner et agent. Mobile : signalement côté locataire, sans upload de photos.

## User stories
1. En tant que locataire, je signale un problème : catégorie (plomberie, électricité, serrurerie, climatisation, nuisibles, structure, autre), description, photos ou vidéo, urgence, disponibilités pour l'intervention, et autorisation d'entrer en mon absence.
2. Je suis mon ticket : statut, intervenant, date prévue. J'échange via un fil de commentaires et je confirme la résolution, ou je la conteste.
3. En tant que gestionnaire, je qualifie le ticket (catégorie, priorité, responsabilité locataire ou bailleur) et je l'assigne à un agent interne ou à un prestataire de mon annuaire.
4. Je demande un ou plusieurs devis aux prestataires, je compare et je choisis. Au-delà du seuil du mandat, le devis choisi part en approbation MAJOR_REPAIR chez le propriétaire.
5. En tant que propriétaire, j'approuve ou je refuse le devis depuis le push ou l'app. L'approbation débloque l'intervention.
6. En tant que prestataire, je reçois la mission par SMS ou WhatsApp avec un lien (pas de compte obligatoire), j'indique la date d'intervention, puis je la marque terminée avec photos et facture.
7. En tant que gestionnaire, je valide l'intervention, je saisis le coût réel et la facture. Une `Expense` est créée et imputée au propriétaire, ou au locataire si la responsabilité lui incombe (refacturation par échéance spéciale).
8. Le locataire note l'intervention (1 à 5).
9. En tant que gestionnaire, je planifie une maintenance préventive récurrente (entretien de la climatisation tous les 6 mois, vidange de fosse, groupe électrogène) : les tickets sont générés automatiquement.
10. En tant que propriétaire, je vois l'historique des interventions et des coûts par bien.

## Règles métier
- **Droit d'ouverture**
  - Locataire avec bail ACTIVE ou TERMINATING sur le bien ; voyageur pendant son séjour CHECKED_IN ;
  - gestionnaire du bien (`AgencyAccessService`) ; propriétaire.
  - Dans les autres cas : 403 `NOT_ALLOWED_ON_PROPERTY`.
- **Machine à états** :

  | De | Vers | Qui | Condition |
  |---|---|---|---|
  | OPEN | TRIAGED | gestionnaire | |
  | TRIAGED / OPEN | AWAITING_QUOTE | gestionnaire | prestataire sollicité |
  | AWAITING_QUOTE | AWAITING_APPROVAL | système | devis retenu au-dessus du seuil |
  | AWAITING_APPROVAL | ASSIGNED | système | approbation APPROVED |
  | AWAITING_APPROVAL | TRIAGED | système | approbation REJECTED |
  | TRIAGED / AWAITING_QUOTE | ASSIGNED | gestionnaire | coût sous le seuil, ou pas d'approbation requise |
  | ASSIGNED | SCHEDULED | gestionnaire / prestataire | date fixée |
  | SCHEDULED / ASSIGNED | IN_PROGRESS | intervenant | |
  | IN_PROGRESS | RESOLVED | intervenant | photos « après » obligatoires si catégorie ≠ AUTRE |
  | RESOLVED | CLOSED | déclarant ou auto à J+5 | |
  | RESOLVED | REOPENED → TRIAGED | déclarant | sous 5 jours |
  | * (avant IN_PROGRESS) | CANCELLED | déclarant / gestionnaire | motif |

- **Urgence** : URGENT notifie immédiatement le gestionnaire et l'agent assigné au mandat (push et SMS), avec un objectif de prise en charge de 4 h. URGENT ne requiert plus l'approbation du propriétaire avant intervention : la sécurité prime, et le propriétaire est informé après coup, sauf configuration contraire du mandat.
- **SLA par priorité** (première action / résolution) : URGENT 4 h / 24 h ; HIGH 24 h / 72 h ; MEDIUM 48 h / 7 j ; LOW 72 h / 15 j. Un dépassement alerte le gérant.
- **Seuil d'approbation** : `Mandate.repairApprovalThreshold` (03), appliqué au montant du devis retenu (et non plus à `estimatedCost` saisi librement).
- **Prestataires**
  - Annuaire par org : nom, métier(s), téléphone, zone, tarif indicatif, note moyenne.
  - Accès à la mission par lien signé (token de 30 jours), limité au ticket : description, adresse, contact du locataire si autorisé, upload de photos, de devis et de facture.
- **Coût réel** : à `RESOLVED`, le gestionnaire saisit `actualCost` et la facture. Cela crée `Expense` (03) en APPROVED si `actualCost ≤ devis × 1,1`, sinon une nouvelle approbation est requise.
- **Imputation** : `chargeTo = OWNER | TENANT | AGENCY`. Si TENANT, une échéance `kind = CHARGES_ADJUSTMENT` est créée sur le bail (04).
- **Visibilité des commentaires** : `PUBLIC` (déclarant, gestionnaire, prestataire) ou `INTERNAL` (gestionnaire et propriétaire seulement).
- **Préventif** : `MaintenancePlan` (bien, catégorie, périodicité en mois, prochaine date). Un cron quotidien crée le ticket à J-7, en statut TRIAGED.
- **Périmètre de liste** : `listForActor` via `AgencyAccessService` et non plus via la seule appartenance à l'org.
- **Événements** : `MAINTENANCE_OPENED` (handler à créer), `MAINTENANCE_STATUS_CHANGED`, `MAINTENANCE_COMMENT_ADDED`, `MAINTENANCE_SLA_BREACHED`.

## Modèle de données
```prisma
enum MaintenanceStatus { OPEN TRIAGED AWAITING_QUOTE AWAITING_APPROVAL ASSIGNED SCHEDULED IN_PROGRESS RESOLVED REOPENED CLOSED CANCELLED }
enum MaintenanceCategory { PLUMBING ELECTRICAL LOCKSMITH HVAC PESTS STRUCTURE APPLIANCE GENERATOR WATER_SUPPLY OTHER }
enum ChargeTo { OWNER TENANT AGENCY }
enum QuoteStatus { REQUESTED SUBMITTED SELECTED DECLINED }

model MaintenanceTicket {
  // + champs
  category          MaintenanceCategory @default(OTHER)
  leaseId           String?
  bookingId         String?
  mandateId         String?
  providerId        String?
  availability      String?
  entryPermission   Boolean   @default(false)
  scheduledAt       DateTime?
  startedAt         DateTime?
  resolvedAt        DateTime?
  closedAt          DateTime?
  firstResponseAt   DateTime?
  slaDueAt          DateTime?
  actualCost        Decimal?
  chargeTo          ChargeTo  @default(OWNER)
  expenseId         String?
  approvalId        String?
  cancelReason      String?
  satisfaction      Int?
  satisfactionComment String?
  planId            String?
  comments          MaintenanceComment[]
  attachments       MaintenanceAttachment[]
  quotes            MaintenanceQuote[]
  history           MaintenanceStatusChange[]
}

model MaintenanceComment { id String @id @default(cuid()) ticketId String authorId String? providerId String? body String visibility String @default("PUBLIC") createdAt DateTime @default(now()) }

model MaintenanceAttachment { id String @id @default(cuid()) ticketId String commentId String? kind String /* BEFORE | AFTER | QUOTE | INVOICE | OTHER */ fileKey String mimeType String uploadedById String? uploadedByProviderId String? createdAt DateTime @default(now()) }

model MaintenanceStatusChange { id String @id @default(cuid()) ticketId String from MaintenanceStatus to MaintenanceStatus actorId String? providerId String? note String? createdAt DateTime @default(now()) }

model ServiceProvider {
  id             String   @id @default(cuid())
  organizationId String
  name           String
  phone          String
  email          String?
  trades         MaintenanceCategory[]
  quartierIds    String[]
  hourlyRate     Decimal?
  rating         Float?
  jobsCount      Int      @default(0)
  active         Boolean  @default(true)
  notes          String?
  createdAt      DateTime @default(now())
}

model MaintenanceQuote {
  id         String      @id @default(cuid())
  ticketId   String
  providerId String
  amount     Decimal?
  currency   String
  description String?
  fileKey    String?
  validUntil DateTime?
  status     QuoteStatus @default(REQUESTED)
  createdAt  DateTime    @default(now())
}

model ProviderAccessToken { id String @id @default(cuid()) providerId String ticketId String tokenHash String @unique expiresAt DateTime revokedAt DateTime? }

model MaintenancePlan {
  id           String              @id @default(cuid())
  propertyId   String
  category     MaintenanceCategory
  title        String
  everyMonths  Int
  nextDueAt    DateTime
  providerId   String?
  active       Boolean             @default(true)
}
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `maintenance/tickets` | locataire / voyageur / gestionnaire / OWNER | **Modifié** : contrôle d'éligibilité, catégorie, disponibilités |
| GET | `maintenance/tickets/my` | déclarant | Existant ; ajouter la pagination |
| GET | `maintenance/tickets/managed` | gestionnaire / OWNER | **Modifié** : périmètre mandat, filtres `status`, `priority`, `category`, `propertyId`, `slaBreached` |
| GET | `maintenance/tickets/:id` | parties | Avec commentaires (selon visibilité), pièces jointes, historique |
| POST | `maintenance/tickets/:id/transitions` | selon la table | `{ to, note? , scheduledAt? }` remplace le PATCH de statut libre |
| PATCH | `maintenance/tickets/:id` | gestionnaire | Champs descriptifs uniquement (catégorie, priorité, chargeTo) |
| POST | `maintenance/tickets/:id/assign` | gestionnaire | `{ assigneeId? , providerId? }` |
| POST | `maintenance/tickets/:id/comments` | parties | `{ body, visibility }` |
| POST | `maintenance/tickets/:id/attachments` | parties | Presign R2 et confirmation |
| POST | `maintenance/tickets/:id/quotes` | gestionnaire | Demande de devis `{ providerIds[] }` |
| POST | `maintenance/quotes/:id/select` | gestionnaire | Retient un devis et déclenche l'approbation si nécessaire |
| POST | `maintenance/tickets/:id/costs` | gestionnaire | `{ actualCost, invoiceKey, chargeTo }` : crée l'Expense |
| POST | `maintenance/tickets/:id/rating` | déclarant | `{ satisfaction, comment }` |
| CRUD | `organizations/:id/providers` | gestionnaire | Annuaire des prestataires |
| GET | `provider-portal/:token` | prestataire (lien) | Vue de la mission |
| POST | `provider-portal/:token/quote` | prestataire | Soumet un devis |
| POST | `provider-portal/:token/transition` | prestataire | SCHEDULED, IN_PROGRESS ou RESOLVED, avec photos |
| POST | `provider-portal/:token/attachments` | prestataire | Upload |
| CRUD | `properties/:id/maintenance-plans` | gestionnaire | Préventif |
| GET | `properties/:id/maintenance-history` | OWNER / gestionnaire | Historique et coûts |

## Écrans
- **Mobile, locataire**
  - Formulaire de signalement : catégorie (icônes), photos ou vidéo via caméra et galerie, disponibilités, autorisation d'entrée.
  - Ticket : timeline des statuts, fil de commentaires, confirmer la résolution ou rouvrir, note.
- **Mobile, gestionnaire** (14) : file des tickets triée par SLA, transitions rapides, photos.
- **Web, agent et owner**
  - `maintenance` : vue liste et kanban par statut, badges SLA, filtres.
  - `maintenance/[id]` : timeline, commentaires (onglets Public et Interne), devis comparés, approbation liée (lien vers `/owner/mandate`), coûts et facture.
  - `/agent/providers` : annuaire.
  - Fiche du bien : onglet « Entretien », avec plans préventifs et historique.
- **Portail prestataire** : `/p/[token]`, page web mobile-first sans compte (mission, devis, photos, statut).

## Critères d'acceptation
- Un utilisateur sans bail ni séjour actif sur le bien reçoit 403 en ouvrant un ticket.
- La transition `OPEN → RESOLVED` directe renvoie 409 `INVALID_TRANSITION`. Chaque transition valide crée un `MaintenanceStatusChange`.
- Un devis de 500 000 XAF pour un seuil de 200 000 passe le ticket en AWAITING_APPROVAL. Après approbation, il passe en ASSIGNED automatiquement (test d'intégration avec 03).
- Un ticket URGENT notifie le gestionnaire par push et SMS en moins d'une minute (`MAINTENANCE_OPENED`).
- Un commentaire INTERNAL n'est jamais renvoyé au déclarant ni au prestataire.
- Le token prestataire ne donne accès qu'à son ticket. Après révocation ou expiration, il renvoie 410.
- `actualCost` et la facture créent une `Expense` et une écriture `EXPENSE` dans le ledger du propriétaire, ou une échéance au locataire si `chargeTo = TENANT`.
- Un plan semestriel crée un ticket 7 jours avant `nextDueAt`, puis décale `nextDueAt` de 6 mois.

## Priorité
- **P0** : contrôle d'éligibilité à l'ouverture, machine à états, déblocage par approbation, listener `MAINTENANCE_OPENED`, périmètre mandat.
- **P1** : commentaires et photos (y compris l'upload mobile), annuaire et assignation des prestataires, devis, coût réel, facture et imputation, SLA.
- **P2** : portail prestataire, maintenance préventive, satisfaction, refacturation au locataire.
