# 11 — Notifications

## Objectif et rôles
Faire en sorte que chaque événement métier important prévienne la bonne personne, sur le bon canal, avec un message lisible en français, de manière fiable (retry, multi-appareils) et selon ses préférences.
Rôles : tous les destinataires. `PLATFORM_ADMIN` gère les templates et la supervision.

## État actuel (audit)
- Canaux : PUSH (FCM), WHATSAPP et SMS (Infobip). Statuts : PENDING, SENT, FAILED.
- **Handlers réels** : seuls `PAYMENT_VALIDATED` (notification et reçu), `SOLVENCY_CHECK_REQUESTED` et `BUYER_PAYMENT_PROOF_REQUESTED` ont un `@OnEvent`. `RentReminderProcessor` (cron à 8 h) appelle `send` directement.
- **Émis sans aucun listener** : `LEASE_CREATED`, `PAYMENT_INITIATED`, `MANDATE_ACTION_PENDING`, `VISIT_BOOKING_CONFIRMED`, `MAINTENANCE_OPENED`.
- `markFailed` **ne passe pas le statut à `FAILED`** (bug).
- Un seul `fcmToken` par user : un nouvel appareil écrase l'ancien.
- Titres et corps de push bruts : « Paradis Immo · TYPE » et « key: value ».
- Pas de retry. Le SMS exige un `organizationId`.
- Pas de préférences par type, uniquement `User.notificationChannel` global. Liste limitée à 100, sans pagination.
- Dédoublonnage des rappels de loyer par requête SQL sur le payload : fonctionnel, mais non indexé.
- Web : icône de notifications dans la `topbar`, sans centre de notifications ni temps réel.

## User stories
1. En tant qu'utilisateur, je reçois des notifications claires (« Loyer de novembre dû dans 3 jours — 150 000 XAF ») qui ouvrent le bon écran au tap (deep link).
2. Je reçois mes push sur tous mes appareils connectés. Un appareil déconnecté ne reçoit plus rien.
3. Je choisis, par catégorie, les canaux que j'accepte :
   - paiements et loyers ;
   - visites ;
   - séjours ;
   - vente ;
   - maintenance ;
   - messages ;
   - mandats et approbations ;
   - marketing et alertes de recherche.
   Les notifications critiques (OTP, sécurité, impayés légaux) ne sont pas désactivables.
4. Je consulte un centre de notifications (mobile et web) paginé, avec non-lus, « tout marquer comme lu » et filtres.
5. Je définis des heures calmes (par défaut 21 h – 7 h) : les notifications non urgentes y sont retardées.
6. En tant qu'admin, je modifie les templates (FR, puis EN en P2) par type et par canal, sans déploiement, et je vois le taux d'envoi, d'échec et de lecture.
7. En tant que gestionnaire, je reçois un récapitulatif quotidien (digest) : visites du jour, approbations en attente, tickets en dépassement de SLA, impayés.

## Règles métier
- **Architecture** : chaque `DOMAIN_EVENT` a un handler dans `notifications/handlers/`. Le handler résout les destinataires, choisit le type, puis appelle `NotificationsService.dispatch(type, recipients, data)`.
  - Le dispatch crée une `Notification` par destinataire et par canal, puis la place en file d'envoi : `@nestjs/bullmq` sur Redis, ou table d'outbox avec worker cron à défaut.
- **Retry** : 3 tentatives avec backoff (1 min, 5 min, 30 min). Ensuite `FAILED` avec `lastError`. Un token FCM invalide (`registration-token-not-registered`) supprime le device.
- **Repli de canal** : si le push échoue ou si l'utilisateur n'a aucun appareil, et que le type est `important`, on bascule sur WhatsApp puis SMS selon les préférences.
- **SMS sans org** : l'org émettrice devient optionnelle. Les SMS sont alors imputés à l'org PLATFORM (sender « ParadisImmo »).
- **Heures calmes** : seuls les types `priority = HIGH` passent (OTP, paiement validé ou échoué, maintenance URGENT, sécurité). Les autres sont différés à la fin de la plage.
- **Dédoublonnage** : `dedupeKey` unique (ex. `RENT_DUE_SOON:{rentScheduleId}:{tier}`), qui remplace la requête SQL sur le JSON.
- **Templates**
  - `NotificationTemplate(type, channel, locale)` avec variables Mustache, et des longueurs maximales par canal : SMS 160 caractères, titre push 65.
  - Les templates WhatsApp doivent correspondre aux templates approuvés chez Meta via Infobip (`waTemplateName`).
- **Deep links** : chaque type déclare `route` (ex. `paradisimmo://lease/{leaseId}/schedule/{rentScheduleId}`) et une URL web équivalente.
- **Digest** : cron à 7 h 30 (Africa/Brazzaville) pour les MANAGER et AGENT qui l'ont activé. Il n'est pas envoyé s'il est vide.
- **Matrice minimale des types à couvrir** (destinataires) :

| Événement | Type | Destinataires |
|---|---|---|
| LEASE_CREATED / envoyé pour signature | LEASE_INVITATION | locataire invité |
| LEASE_ACTIVATED | LEASE_ACTIVATED | locataire, propriétaire |
| LEASE_TERMINATION_NOTICE | LEASE_NOTICE | autre partie, gestionnaire |
| RENT_DUE_SOON / RENT_OVERDUE | (existant) | locataire, puis gestionnaire à J+5 |
| PAYMENT_INITIATED | — | aucun (journal uniquement) |
| PAYMENT_VALIDATED | PAYMENT_RECEIVED | payeur, et gestionnaire pour les espèces validées par un autre |
| PAYMENT_FAILED / EXPIRED | PAYMENT_FAILED | payeur |
| PAYMENT_DISPUTED | DISPUTE_OPENED | gestionnaire |
| REFUND succeeded | REFUND_DONE | payeur |
| PAYOUT_PAID / FAILED | PAYOUT_* | propriétaire / finance |
| MANDATE_PROPOSED / ACCEPTED / TERMINATED | MANDATE_* | agence / propriétaire |
| MANDATE_ACTION_PENDING | APPROVAL_REQUESTED | propriétaire (push actionnable) |
| MANDATE_ACTION_DECIDED | APPROVAL_DECIDED | demandeur |
| MANDATE assign | MANDATE_ASSIGNED | agent |
| VISIT_BOOKING_CONFIRMED | VISIT_CONFIRMED | chercheur, agent |
| Rappels visite J-1 / H-2 | VISIT_REMINDER | chercheur, agent |
| Visite annulée ou reprogrammée | VISIT_CHANGED | autre partie |
| BOOKING_CONFIRMED / REQUESTED / CANCELLED | STAY_* | voyageur / hôte |
| Arrivée J-1 | STAY_ARRIVAL | voyageur (instructions) |
| SALE_INQUIRY_CREATED | SALE_INQUIRY | agent attribué, ADMIN |
| SALE_OFFER_* | SALE_OFFER_* | contrepartie |
| SALE_INSTALLMENT_DUE | SALE_INSTALLMENT_DUE | acheteur |
| MAINTENANCE_OPENED | MAINTENANCE_NEW | gestionnaire (SMS si URGENT) |
| MAINTENANCE_STATUS_CHANGED | MAINTENANCE_UPDATE | déclarant |
| MAINTENANCE_SLA_BREACHED | MAINTENANCE_SLA | gérant |
| MESSAGE_CREATED | NEW_MESSAGE | autres participants |
| SOLVENCY / BUYER_PROOF | (existant) | — |
| Invitation org | ORG_INVITATION | invité (SMS ou e-mail) |
| Annonce modérée | LISTING_MODERATED | propriétaire ou agence (avec motif) |
| Alerte de recherche | SEARCH_ALERT | chercheur (13) |
| Sécurité (nouvel appareil, changement de téléphone) | SECURITY_ALERT | user |

## Modèle de données
```prisma
enum NotificationStatus { PENDING QUEUED SENT DELIVERED FAILED SKIPPED }
enum NotificationCategory { PAYMENTS VISITS STAYS SALES MAINTENANCE MESSAGES MANDATES LEASES ACCOUNT MARKETING }

model UserDevice {
  id          String         @id @default(cuid())
  userId      String
  fcmToken    String         @unique
  platform    DevicePlatform
  deviceId    String
  appVersion  String?
  locale      String?
  lastSeenAt  DateTime       @default(now())
  createdAt   DateTime       @default(now())
  @@unique([userId, deviceId])
}
// User.fcmToken : migré vers UserDevice puis supprimé

model NotificationPreference {
  userId    String
  category  NotificationCategory
  push      Boolean @default(true)
  whatsapp  Boolean @default(true)
  sms       Boolean @default(false)
  email     Boolean @default(false)
  @@id([userId, category])
}

model User {
  quietHoursStart String? @default("21:00")
  quietHoursEnd   String? @default("07:00")
  digestEnabled   Boolean @default(true)
  locale          String  @default("fr")
}

model Notification {
  // + champs
  category       NotificationCategory
  title          String
  body           String
  deepLink       String?
  priority       String   @default("NORMAL") // HIGH | NORMAL | LOW
  dedupeKey      String?  @unique
  attempts       Int      @default(0)
  lastError      String?
  scheduledFor   DateTime @default(now())
  providerMessageId String?
  deliveredAt    DateTime?
  @@index([userId, createdAt])
  @@index([status, scheduledFor])
}

model NotificationTemplate {
  id             String              @id @default(cuid())
  type           String
  channel        NotificationChannel
  locale         String              @default("fr")
  title          String?
  body           String
  waTemplateName String?
  active         Boolean             @default(true)
  updatedById    String?
  updatedAt      DateTime            @updatedAt
  @@unique([type, channel, locale])
}

enum NotificationChannel { PUSH WHATSAPP SMS EMAIL IN_APP }
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `users/me/devices` | auth | Enregistre ou rafraîchit `{ fcmToken, deviceId, platform, appVersion }` (remplace la mise à jour de `fcmToken`) |
| DELETE | `users/me/devices/:deviceId` | auth | Appelé au logout |
| GET | `notifications` | auth | **Modifié** : paginé, `?unread&category` |
| GET | `notifications/unread-count` | auth | |
| POST | `notifications/:id/read` | auth | Existant ou à confirmer |
| POST | `notifications/read-all` | auth | |
| GET | `users/me/notification-preferences` | auth | |
| PUT | `users/me/notification-preferences` | auth | `[{ category, push, whatsapp, sms, email }]`, plus heures calmes et digest |
| GET | `admin/notification-templates` | admin | |
| PUT | `admin/notification-templates/:id` | admin | Avec aperçu `POST …/preview` |
| GET | `admin/notifications/stats` | admin | Envoyées, échouées et lues, par type et par canal, sur 7 et 30 jours |
| GET | `admin/notifications/failed` | admin | Échecs, avec relance |
| POST | `admin/notifications/:id/retry` | admin | |

## Écrans
- **Mobile**
  - Écran « Notifications » : liste paginée, non-lus, filtres, tap vers le deep link.
  - `profile/notifications` : préférences par catégorie et par canal, heures calmes.
  - Badge sur l'icône de l'app.
  - Push actionnables (catégories iOS et Android) : « Approuver » et « Refuser » pour APPROVAL_REQUESTED, « Payer » pour un loyer.
- **Web**
  - Panneau déroulant de la `topbar` avec la liste et « tout lire ». Page `/notifications`.
  - `/settings/notifications`.
- **Admin** : `/admin/notifications` (templates, statistiques, échecs).

## Critères d'acceptation
- Chaque entrée de `DOMAIN_EVENTS` a un handler, ou figure explicitement dans la liste d'exclusion (test qui parcourt l'enum).
- `markFailed` met `status = FAILED` et `lastError`. Une 3ᵉ tentative échouée laisse `FAILED`.
- Un utilisateur connecté sur 2 téléphones reçoit le push sur les deux. Après logout sur l'un, seul l'autre le reçoit.
- Aucun push n'a pour titre « Paradis Immo · RENT_DUE_SOON » : tous les types ont un template FR (test de couverture).
- Une catégorie désactivée pour le push n'envoie rien sur ce canal. Un OTP passe toujours.
- Une notification NORMAL à 22 h est envoyée à 7 h. Une notification HIGH part immédiatement.
- Un événement rejoué (même `dedupeKey`) ne crée pas de doublon.
- `GET notifications?limit=20&offset=100` fonctionne au-delà de 100 éléments.

## Priorité
- **P0** : correctif de `markFailed`, handlers des 5 événements orphelins, templates lisibles, SMS sans org.
- **P1** : multi-appareils, file avec retry, préférences par catégorie, centre de notifications paginé (mobile et web), deep links, couverture de la matrice.
- **P2** : heures calmes, digest gestionnaire, push actionnables, templates éditables en admin, statistiques.
