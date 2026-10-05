# 06 — Visites

## Objectif et rôles
Fiabiliser la prise de rendez-vous de visite (gratuite ou payante), son déroulé et son suivi commercial.
Rôles : `SEEKER`, `AGENT` (visiteur terrain), `MANAGER`, `OWNER`.

## État actuel (audit)
- `VisitSlotTemplate` génère des `VisitSlot` (via `slot-generator`). Les créneaux manuels sont possibles. `VisitType` : FREE ou PAID.
- `VisitBooking` : PENDING, CONFIRMED, CANCELLED, COMPLETED, NO_SHOW.
  - Une visite payante reste PENDING sans réserver le créneau : **double réservation possible**.
  - Aucun endpoint pour passer en COMPLETED ou NO_SHOW. Pas de reprogrammation ni de rappel.
- `VISIT_BOOKING_CONFIRMED` est émis sans listener.
- Mobile : `cancelVisit` existe dans la lib mais aucun écran ne l'utilise.
- Pas de capacité par créneau (une seule personne), pas d'agent assigné à la visite, pas de compte rendu, pas de lien entre visite et candidature ou offre.

## User stories
1. En tant que chercheur, je réserve un créneau. S'il est payant, il est **bloqué 15 minutes** pendant le paiement, puis confirmé ; sinon il est libéré.
2. Je reçois une confirmation (push et WhatsApp/SMS) avec l'adresse, le contact de l'agent et un lien vers l'itinéraire, puis des rappels à J-1 et à H-2.
3. Je reprogramme ma visite vers un autre créneau libre (2 fois maximum), ou je l'annule. Pour une visite payante, le remboursement dépend du délai (politique ci-dessous).
4. En tant que gestionnaire, je vois l'agenda des visites (jour, semaine), filtrable par agent et par bien. J'assigne un agent à une visite ou à un template.
5. En tant qu'agent, je marque la visite effectuée ou non honorée, avec compte rendu : intérêt (1 à 5), remarques, suite à donner (candidature, offre, relance).
6. En tant qu'agent, j'annule ou je déplace une visite (indisponibilité, bien loué). Le chercheur est notifié et remboursé intégralement.
7. En tant que chercheur, après la visite, je reçois une invitation à postuler (location) ou à faire une offre (vente), et à noter l'agence (02).
8. En tant que gestionnaire, je bloque une plage (congés, travaux) : les créneaux concernés passent en BLOCKED et les visites réservées doivent être déplacées.
9. Visite groupée en option : un créneau a une capacité supérieure à 1, utile pour les journées portes ouvertes.

## Règles métier
- **Hold**
  - `VisitBooking` est créé `PENDING` avec `holdExpiresAt = now + 15 min`, et le créneau passe immédiatement `HELD` dans la même transaction.
  - Cron toutes les minutes : expiration des holds (booking `EXPIRED`, créneau `AVAILABLE`).
  - Visite gratuite : directement CONFIRMED, créneau BOOKED (ou capacité décrémentée).
- **Concurrence** : réservation en transaction avec verrou sur le créneau (`SELECT … FOR UPDATE`) ou `bookedCount < capacity` en update conditionnel.
- **Limites** : 3 visites à venir au plus par chercheur et par bien, et 10 au total.
- **Politique d'annulation (visite payante)**
  - Par le chercheur : plus de 24 h avant, remboursement de 100 % ; entre 24 h et 2 h, 50 % ; moins de 2 h ou no-show, 0 %.
  - Par l'agence : toujours 100 %.
  - Les pourcentages sont paramétrables par org.
- **Reprogrammation** : 2 au maximum. Le paiement est conservé, et l'écart de prix éventuel donne lieu à un supplément ou à un remboursement.
- **Clôture** : COMPLETED ou NO_SHOW n'est possible qu'après l'heure de début. Sans action, un passage automatique en `COMPLETED_UNCONFIRMED` a lieu à H+24, puis une relance est envoyée à l'agent.
- **No-show** : après 2 no-shows en 90 jours, le chercheur ne peut plus réserver de visite gratuite pendant 30 jours.
- **Statuts** : `PENDING` (hold) → `CONFIRMED` → `COMPLETED` | `NO_SHOW` | `CANCELLED_BY_SEEKER` | `CANCELLED_BY_AGENCY` ; `PENDING` → `EXPIRED`. `RESCHEDULED` est tracé dans l'historique, et non comme un statut final.
- **Créneau** : `AVAILABLE` → `HELD` → `BOOKED` (ou `FULL` si capacité atteinte), plus `BLOCKED`.
- **Bien indisponible** : passer le bien en OCCUPIED ou SOLD annule automatiquement les visites futures (par l'agence), avec remboursement.

## Modèle de données
```prisma
enum VisitBookingStatus { PENDING CONFIRMED COMPLETED COMPLETED_UNCONFIRMED NO_SHOW CANCELLED_BY_SEEKER CANCELLED_BY_AGENCY EXPIRED }
enum VisitSlotStatus { AVAILABLE HELD BOOKED FULL BLOCKED }

model VisitSlot {
  // + champs
  capacity      Int     @default(1)
  bookedCount   Int     @default(0)
  agentId       String?
  meetingPoint  String?
}

model VisitSlotTemplate {
  // + champs
  capacity Int     @default(1)
  agentId  String?
}

model VisitBooking {
  // + champs
  holdExpiresAt    DateTime?
  paymentId        String?
  agentId          String?
  rescheduleCount  Int       @default(0)
  cancelledById    String?
  cancelReason     String?
  cancelledAt      DateTime?
  completedAt      DateTime?
  reminderJ1SentAt DateTime?
  reminderH2SentAt DateTime?
  history          VisitBookingEvent[]
  report           VisitReport?
}

model VisitBookingEvent { id String @id @default(cuid()) visitBookingId String kind String fromSlotId String? toSlotId String? actorId String createdAt DateTime @default(now()) }

model VisitReport {
  id             String   @id @default(cuid())
  visitBookingId String   @unique
  authorId       String
  interestLevel  Int?
  notes          String?
  nextStep       String?  // APPLY | OFFER | FOLLOW_UP | NONE
  followUpAt     DateTime?
  createdAt      DateTime @default(now())
}

model VisitBlackout { id String @id @default(cuid()) propertyId String? organizationId String? agentId String? startsAt DateTime endsAt DateTime reason String? }

model Organization {
  visitRefundFullHours Int @default(24)
  visitRefundHalfHours Int @default(2)
}
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `visit-slots/:id/book` | SEEKER | **Modifié** : hold de 15 minutes si payant, renvoie `{ booking, paymentQuote }` |
| POST | `visit-bookings/:id/cancel` | chercheur / gestionnaire | `{ reason }` ; calcule et déclenche le remboursement (05) |
| POST | `visit-bookings/:id/reschedule` | chercheur / gestionnaire | `{ newSlotId }` |
| POST | `visit-bookings/:id/complete` | AGENT / MANAGER | `{ report? }` |
| POST | `visit-bookings/:id/no-show` | AGENT / MANAGER | |
| PUT | `visit-bookings/:id/report` | AGENT / MANAGER | Compte rendu |
| PATCH | `visit-bookings/:id/assign` | MANAGER | `{ agentId }` |
| GET | `visit-bookings/managed` | gestionnaire | `?from&to&agentId&propertyId&status`, paginé, pour l'agenda |
| GET | `visit-bookings/mine` | SEEKER | **Modifié** : paginé, avec les actions disponibles (`canCancel`, `canReschedule`, `refundPercent`) |
| POST | `visit-blackouts` | gestionnaire | Bloque une plage |
| DELETE | `visit-blackouts/:id` | gestionnaire | |
| PATCH | `visit-slot-templates/:id` | gestionnaire | Ajouter `capacity` et `agentId` |

## Écrans
- **Mobile, chercheur**
  - Détail de la visite : actions Annuler et Reprogrammer, en utilisant `cancelVisit` (aujourd'hui inutilisé) et la nouvelle route `reschedule`.
  - Itinéraire (deep link vers Maps), contact de l'agent (appel ou messagerie, voir 10).
  - Compte à rebours du hold pendant le paiement.
  - Après la visite : CTA « Postuler » ou « Faire une offre ».
- **Mobile, agent** (14) : « Mes visites du jour », check-in sur place, boutons Effectuée et Absent, compte rendu rapide.
- **Web**
  - `/agent/visits` et `/owner/visits` : vue agenda (semaine) en plus de la liste, filtres par agent et par bien, glisser-déposer pour reprogrammer, panneau de compte rendu.
  - `/agent/portfolio/[id]/visit-slots` : ajouter la capacité, l'agent et les plages bloquées.

## Critères d'acceptation
- Deux réservations simultanées du même créneau (capacité 1) : une seule réussit, l'autre reçoit 409 `SLOT_UNAVAILABLE`.
- Une visite payante non payée 15 minutes plus tard passe à EXPIRED et le créneau redevient AVAILABLE.
- Une annulation par le chercheur 10 h avant déclenche un remboursement de 50 %.
- `complete` avant l'heure du créneau renvoie 409 `VISIT_NOT_STARTED`.
- `VISIT_BOOKING_CONFIRMED` envoie une confirmation au chercheur et à l'agent assigné. Les rappels J-1 et H-2 sont envoyés une seule fois.
- Passer le bien en OCCUPIED annule les visites futures et notifie les chercheurs.

## Priorité
- **P0** : hold du créneau pour les visites payantes et verrou de concurrence, annulation exposée sur mobile, endpoints COMPLETED et NO_SHOW, listener de confirmation.
- **P1** : reprogrammation, rappels, politique de remboursement, agenda web, assignation d'agent, compte rendu.
- **P2** : capacité ou visites groupées, plages bloquées, pénalité de no-show, relances post-visite.
