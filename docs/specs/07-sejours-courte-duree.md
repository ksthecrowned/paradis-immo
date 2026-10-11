# 07 — Séjours courte durée (RENT_SHORT)

## Objectif et rôles
Offrir un parcours de réservation de type Airbnb fiable : disponibilité exacte, tarification complète, réservation bloquée seulement après paiement, annulation et remboursement, arrivée, départ, caution et avis.
Rôles : `GUEST`, `OWNER`, `MANAGER`, `AGENT` (hôte opérationnel).

## État actuel (audit local, 2026-10-11)
### Déjà en place
- Cycle de réservation avec acceptation/refus, arrivée, départ et annulation par l'hôte.
- Déclaration de dégâts, aperçu des frais d'annulation, devis, tarifs saisonniers et réglages de séjour.
- Le parcours mobile de réservation et de paiement a reçu des changements locaux ; le devis est également pris en charge côté API.

### Écarts
- Changement de dates et gestion des blocages de disponibilité ne sont pas implémentés.
- La synchronisation iCal (import/export) n'est pas disponible.
- Aucun écran web ne permet encore de gérer les réglages du séjour.
- Vérifier séparément la disponibilité transactionnelle et l'intégration des blocages avant de considérer les réservations robustes en concurrence.

## User stories
1. En tant que voyageur, je choisis mes dates sur un calendrier qui grise les nuits indisponibles (réservations, blocages, minimum de séjour), et j'indique le nombre de voyageurs.
2. Je vois le détail du prix avant de payer : nuits × tarif (saisonnier ou week-end), réductions semaine ou mois, frais de ménage, frais de service, taxe de séjour, caution (pré-autorisée ou à régler sur place).
3. Je réserve : les dates sont bloquées 15 minutes le temps du paiement, puis confirmées après paiement.
4. Option du bien « réservation sur demande » : l'hôte accepte ou refuse sous 24 h. Je ne suis débité qu'après acceptation, sinon la demande expire.
5. Je reçois la confirmation avec les instructions d'arrivée (adresse exacte, contact, code ou remise des clés), révélées 48 h avant l'arrivée.
6. J'annule ma réservation. Le remboursement suit la politique du bien (Flexible, Modérée, Stricte), et le montant remboursé est affiché avant confirmation.
7. En tant qu'hôte, je gère le calendrier : blocages, tarif par date, minimum de nuits, et synchronisation iCal (import et export) avec Airbnb et Booking.
8. En tant qu'hôte, j'annule une réservation (cas exceptionnel). Le voyageur est remboursé à 100 % et l'annulation est tracée (pénalité de visibilité éventuelle).
9. En tant qu'hôte, je confirme l'arrivée (check-in) et le départ (check-out). Je signale un dommage sous 48 h après le départ, ce qui entraîne une retenue sur la caution.
10. Après le séjour, le voyageur et l'hôte se notent mutuellement (02).
11. En tant que voyageur, je modifie les dates d'un séjour à venir, sous réserve de disponibilité, avec ajustement du prix.

## Règles métier
- **Statuts** : `PENDING_PAYMENT` (hold) → `CONFIRMED` → `CHECKED_IN` → `CHECKED_OUT` → `COMPLETED` ; `REQUESTED` → `ACCEPTED` (→ PENDING_PAYMENT) | `DECLINED` | `EXPIRED` ; `CANCELLED_BY_GUEST` ; `CANCELLED_BY_HOST` ; `PENDING_PAYMENT` → `EXPIRED`.
- **Disponibilité**
  - Une nuit est indisponible si elle est couverte par un booking `PENDING_PAYMENT` (hold non expiré), `CONFIRMED`, `CHECKED_IN`, par un `AvailabilityBlock`, ou par un bail long terme ACTIVE.
  - Contrôle en transaction sérialisable, ou via contrainte d'exclusion Postgres (`EXCLUDE USING gist (property_id WITH =, daterange WITH &&)`) sur les états bloquants.
- **Hold** : 15 minutes. Cron d'expiration toutes les minutes.
- **Tarification (`PricingQuote`, calculée côté serveur)**
  - Base : `Σ nightlyRate(date)`, en appliquant `SeasonalRate` > tarif week-end > tarif de base.
  - Réductions : `weeklyDiscount` dès 7 nuits, `monthlyDiscount` dès 28 nuits.
  - Frais : `cleaningFee` fixe, `extraGuestFee` par voyageur au-delà de `baseGuests`.
  - `serviceFee` : % plateforme, paramétré en 12.
  - `touristTax` : par personne et par nuit, paramétré par ville.
  - Le devis est figé dans `Booking.priceBreakdown` au moment du hold.
- **Contraintes** : `minNights`, `maxNights`, `maxGuests`, `advanceNoticeHours` (24 par défaut), `bookingWindowDays` (365).
- **Politique d'annulation**
  - Flexible : 100 % jusqu'à 24 h avant l'arrivée, puis la première nuit est retenue.
  - Modérée : 100 % jusqu'à 5 jours avant, puis 50 %.
  - Stricte : 50 % jusqu'à 7 jours avant, puis 0 %.
  - Les frais de service ne sont jamais remboursés, sauf en cas d'annulation par l'hôte. La taxe de séjour est toujours remboursée si le séjour n'a pas eu lieu.
- **Caution**
  - Le mobile money ne permettant pas de pré-autorisation, deux modes : `COLLECT_ON_BOOKING` (encaissée, puis remboursée automatiquement à J+3 après le départ sans réclamation) ou `ON_SITE` (information seulement).
  - Une réclamation de dommages bloque le remboursement automatique jusqu'à résolution (05, litiges).
- **Réservation sur demande** : délai d'acceptation de 24 h. Pas de hold pendant la demande, mais les dates sont affichées « en attente ». Après acceptation, le voyageur dispose de 2 h pour payer.
- **Révélation de l'adresse** : l'adresse exacte et les instructions sont masquées (quartier seulement) jusqu'à CONFIRMED et au plus tôt 48 h avant l'arrivée.
- **Périmètre gestionnaire** : `listManaged` passe par `AgencyAccessService` (mandat avec scope `SHORT_STAY`, voir 03).
- **iCal**
  - Export : URL secrète par bien.
  - Import : poll toutes les 30 minutes. Les événements importés deviennent des `AvailabilityBlock` de source `ICAL`.
- **Événements** : `BOOKING_HELD`, `BOOKING_CONFIRMED`, `BOOKING_REQUESTED`, `BOOKING_CANCELLED`, `BOOKING_CHECKED_IN`, `BOOKING_COMPLETED`, `BOOKING_DAMAGE_REPORTED`.

## Modèle de données
```prisma
enum BookingStatus { REQUESTED ACCEPTED DECLINED PENDING_PAYMENT CONFIRMED CHECKED_IN CHECKED_OUT COMPLETED CANCELLED_BY_GUEST CANCELLED_BY_HOST EXPIRED }
enum CancellationPolicy { FLEXIBLE MODERATE STRICT }
enum DepositMode { NONE COLLECT_ON_BOOKING ON_SITE }
enum AvailabilityReason { BOOKING MAINTENANCE MANUAL ICAL LEASE }

model StayListingSettings {
  propertyId          String  @id
  baseNightlyRate     Decimal
  weekendNightlyRate  Decimal?
  weeklyDiscount      Decimal? // 0.10
  monthlyDiscount     Decimal?
  cleaningFee         Decimal @default(0)
  baseGuests          Int     @default(2)
  maxGuests           Int
  extraGuestFee       Decimal @default(0)
  minNights           Int     @default(1)
  maxNights           Int     @default(90)
  advanceNoticeHours  Int     @default(24)
  bookingWindowDays   Int     @default(365)
  instantBook         Boolean @default(true)
  cancellationPolicy  CancellationPolicy @default(MODERATE)
  depositMode         DepositMode @default(NONE)
  depositAmount       Decimal @default(0)
  checkInFrom         String  @default("14:00")
  checkOutBefore      String  @default("11:00")
  houseRules          String?
  arrivalInstructions String?   // révélées après confirmation
  icalExportToken     String  @unique
}

model SeasonalRate { id String @id @default(cuid()) propertyId String startDate DateTime endDate DateTime nightlyRate Decimal minNights Int? label String? }

model IcalFeed { id String @id @default(cuid()) propertyId String url String label String lastSyncedAt DateTime? lastError String? }

model Booking {
  // + champs
  guests          Int
  priceBreakdown  Json      // { nights[], subtotal, discounts, cleaningFee, extraGuests, serviceFee, touristTax, deposit, total }
  depositAmount   Decimal   @default(0)
  holdExpiresAt   DateTime?
  requestExpiresAt DateTime?
  paymentId       String?
  cancellationPolicy CancellationPolicy
  cancelledById   String?
  cancelReason    String?
  cancelledAt     DateTime?
  refundAmount    Decimal?
  checkedInAt     DateTime?
  checkedOutAt    DateTime?
  guestMessage    String?
  damageReports   StayDamageReport[]
}

model AvailabilityBlock {
  // + champs
  source     String  @default("MANUAL") // MANUAL | ICAL | MAINTENANCE
  icalFeedId String?
  externalUid String?
}

model StayDamageReport {
  id         String   @id @default(cuid())
  bookingId  String
  reporterId String
  description String
  amountClaimed Decimal
  photoKeys  String[]
  status     String   // OPEN | ACCEPTED | DISPUTED | RESOLVED
  createdAt  DateTime @default(now())
}

model CityTax { cityId String @id perPersonPerNight Decimal currency String }
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `properties/:id/availability` | public | `?from&to` : nuits libres, minimum de séjour, tarifs par nuit |
| POST | `properties/:id/stay-quote` | public | `{ startDate, endDate, guests }` : devis détaillé |
| POST | `bookings` | GUEST | **Modifié** : crée PENDING_PAYMENT (ou REQUESTED), renvoie `{ booking, quote, holdExpiresAt }` |
| POST | `bookings/:id/accept` | hôte | Réservation sur demande |
| POST | `bookings/:id/decline` | hôte | `{ reason }` |
| POST | `bookings/:id/cancel` | voyageur / hôte | **Modifié** : calcul du remboursement et déclenchement (05) |
| GET | `bookings/:id/cancellation-preview` | voyageur | Montant remboursé si annulation maintenant |
| POST | `bookings/:id/change-dates` | voyageur | `{ startDate, endDate }` : nouveau devis, puis supplément ou remboursement |
| POST | `bookings/:id/check-in` | hôte | |
| POST | `bookings/:id/check-out` | hôte | |
| POST | `bookings/:id/damage-reports` | hôte | Sous 48 h après le check-out |
| GET | `bookings/:id/arrival` | voyageur | Instructions (403 avant la fenêtre) |
| GET | `bookings/managed` | gestionnaire | **Modifié** : périmètre via mandat, `?from&to&status&propertyId`, paginé |
| PUT | `properties/:id/stay-settings` | gestionnaire | Paramètres du séjour |
| CRUD | `properties/:id/seasonal-rates` | gestionnaire | Tarifs saisonniers |
| CRUD | `properties/:id/availability-blocks` | gestionnaire | Blocages |
| CRUD | `properties/:id/ical-feeds` | gestionnaire | Import iCal |
| GET | `ical/:token.ics` | public | Export iCal |

## Écrans
- **Mobile, voyageur**
  - `property/[id]/book` : calendrier de disponibilité réel, sélecteur de voyageurs, devis détaillé, politique d'annulation, règlement à accepter. Passage du `bookingId` au checkout (bug actuel).
  - `booking/[id]` : statut, instructions d'arrivée, contact de l'hôte (10), Annuler (avec aperçu du remboursement), Modifier les dates.
  - Compte à rebours du hold.
- **Web, hôte**
  - `/owner/bookings` et `/agent/bookings` : vue calendrier multi-biens (timeline), demandes à accepter, check-in et check-out, déclaration de dommages.
  - `properties/[id]/edit` : onglet « Séjours » (tarifs, saisons, frais, règles, iCal, politique).

## Critères d'acceptation
- Créer un booking ne bloque les dates que 15 minutes. Sans paiement, il passe EXPIRED et les dates se libèrent.
- 50 requêtes concurrentes sur les mêmes dates produisent une seule réservation (test de charge, contrainte d'exclusion).
- Une réservation qui chevauche un `AvailabilityBlock` ou un bail ACTIVE renvoie 409 `DATES_UNAVAILABLE`.
- Le total payé est égal à `priceBreakdown.total` et ne dépend d'aucun montant envoyé par le client.
- Une annulation en politique Modérée 3 jours avant l'arrivée rembourse 50 % des nuits, la taxe de séjour à 100 %, et rien des frais de service.
- L'annulation par l'hôte rembourse 100 %, frais de service inclus.
- `GET bookings/:id/arrival` renvoie 403 plus de 48 h avant l'arrivée.
- Un événement iCal importé bloque les dates en moins de 30 minutes.

## Priorité
- **P0** : [x] réservation/paiement avec transmission locale du `bookingId` et aperçu d'annulation ; [x] cycle hôte (acceptation/refus, check-in/out, annulation) ; [ ] confirmer l'atomicité de la disponibilité et le traitement des blocages.
- **P1** : [x] devis, paramètres et tarifs saisonniers ; [x] déclaration de dégâts ; [ ] modification des dates ; [ ] écrans web de réglages et gestion du calendrier.
- **P2** : [ ] synchronisation iCal, gestion complète des blocages et automatisation de la caution/dommages.

## Delta d'implémentation
| ID | Priorité | Delta | État |
|---|---|---|---|
| 07.1 | P0 | Garantir l'exclusion des chevauchements et vérifier les blocages de disponibilité au moment de réserver. | **Partiel.** Les parcours de réservation pour compte tiers et la liste des séjours gérés réutilisent désormais l'accès propriété par rôle/mandat actif. L'audit de concurrence, de blocages et d'autorisation sur tout le cycle de réservation reste ouvert. |
| 07.2 | P1 | Permettre au voyageur de changer les dates avec nouveau devis et ajustement de prix. | À faire |
| 07.3 | P1 | Ajouter les écrans web de réglages du séjour et de gestion du calendrier. | À faire |
| 07.4 | P2 | Implémenter les blocages de disponibilité et la synchronisation iCal import/export. | À faire |
