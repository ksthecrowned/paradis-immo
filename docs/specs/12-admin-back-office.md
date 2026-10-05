# 12 — Administration et back-office plateforme

## Objectif et rôles
Donner à l'équipe Paradis Immo les outils pour opérer la plateforme :
- utilisateurs, organisations et KYC ;
- modération ;
- finance ;
- support ;
- configuration métier ;
- traçabilité (audit log).

Rôles : `PLATFORM_ADMIN`, à découper en sous-rôles : `SUPER_ADMIN`, `OPS` (modération et support), `FINANCE`, `READ_ONLY`.

## État actuel (audit)
- **API `admin`**
  - `GET stats`, `GET users` (sans recherche ni filtres), `GET reports`, `PATCH reports/:id`, `PATCH properties/:id/moderate`, `PATCH properties/:id/featured`.
  - La modération change le statut **sans motif ni notification** au propriétaire.
  - Il manque : suspension et gestion des rôles, organisations et affiliation, paiements et finance, audit log, configuration.
- **Web admin**
  - Pages : dashboard (statistiques basiques), moderation, reports, users (liste), config.
  - `config` n'affiche que les URL des stores, en lecture seule depuis les variables d'environnement.
- **Signalements** : `PropertyReport` (OPEN, REVIEWED, DISMISSED, ACTIONED), sans suivi pour le déclarant.
- **Rôles admin** : un seul `GlobalRole.PLATFORM_ADMIN`, sans granularité.

## User stories
### Utilisateurs
1. Je recherche un utilisateur par nom, téléphone, e-mail ou identifiant, et je filtre par rôle, statut, date d'inscription et pays.
2. Je vois sa fiche 360° : profil, sessions, organisations, biens, baux, séjours, paiements, tickets, signalements reçus et émis, notifications récentes.
3. Je le suspends ou le réactive (motif obligatoire, notification), je force la déconnexion, et je réinitialise son téléphone en cas de perte (procédure KYC).
4. J'attribue ou je retire un rôle admin (SUPER_ADMIN uniquement).
5. Je me connecte « en tant que » l'utilisateur (impersonation) en lecture seule, pour le support. L'utilisateur en est informé dans son journal de sécurité.

### Organisations et KYC
6. Je traite la file d'affiliation des agences PENDING : documents RCCM et NIU, puis approbation ou refus motivé.
7. Je traite la file KYC des utilisateurs et des organisations (01).
8. Je suspends une agence : ses annonces passent en pause, et ses gestionnaires et mandants sont notifiés.
9. Je vois les indicateurs d'une agence : biens, mandats, volume encaissé, litiges, avis, SLA de maintenance.

### Modération
10. Je modère les annonces : file des nouvelles publications (pré-modération optionnelle par configuration), approbation, demande de correction ou refus, avec un motif choisi dans une liste et un commentaire. Le propriétaire ou l'agence est notifié.
11. Je traite les signalements d'annonces, de messages (10) et d'avis (02). Le déclarant est informé de l'issue.
12. Je repère les doublons d'annonces (mêmes photos, mêmes coordonnées) et les fraudes (prix aberrant, compte récent qui publie beaucoup).

### Finance
13. Je vois tous les paiements, avec recherche par référence, téléphone ou montant, et filtres par statut, fournisseur et période.
14. J'approuve les remboursements au-dessus du seuil, je traite les litiges escaladés, et je relance les reversements échoués (05).
15. J'importe les relevés fournisseurs et je résous les écarts de rapprochement (05).
16. J'exporte un rapport financier mensuel : encaissements par méthode, commissions plateforme, frais de service, reversements.

### Configuration métier (sans déploiement)
17. Je modifie les paramètres :
    - frais de service des séjours, taxe de séjour par ville ;
    - plafond de caution par pays ;
    - seuils de remboursement ;
    - délais (hold, expiration) ;
    - liste des motifs de modération ;
    - feature flags (pré-modération, messagerie, iCal…).
18. Je gère les référentiels : pays, villes, arrondissements, quartiers (avec coordonnées), équipements (`PropertyFeatureId`).
19. Je publie des annonces système (bannière dans l'app) et j'impose une version minimale de l'app (force update).
20. Je gère les templates de notifications (11) et les versions des CGU (01).

### Traçabilité et pilotage
21. Je consulte l'audit log de toutes les actions sensibles (qui, quoi, quand, avant/après, IP), filtrable et exportable.
22. Le tableau de bord présente des KPI avec tendances : inscriptions, annonces actives par mode, taux de conversion visite → bail, GMV, impayés, tickets ouverts, délai moyen de modération.

## Règles métier
- **RBAC admin**
  - `SUPER_ADMIN` : tout.
  - `OPS` : utilisateurs (sans les rôles), organisations, modération, support.
  - `FINANCE` : paiements, remboursements, reversements, rapprochement, exports.
  - `READ_ONLY` : lecture seule.
  - Contrôle par décorateur `@AdminPermission('finance.refund.approve')`.
- **Authentification admin** : mot de passe ou Google (existant), plus une **2FA TOTP obligatoire**, une session de 8 h et une allowlist d'IP optionnelle.
- **Audit log obligatoire** pour :
  - toute action admin ;
  - validation de paiement en espèces, remboursement, reversement ;
  - décision d'approbation de mandat ;
  - changement de rôle dans une organisation ;
  - activation et résiliation de bail ;
  - accès admin à une conversation ;
  - impersonation.
  L'audit log est en ajout seul : aucune suppression ni modification, conservation 5 ans.
- **Modération**
  - Motifs : `PHOTOS_INSUFFISANTES`, `PRIX_INCOHERENT`, `ADRESSE_INVALIDE`, `DOUBLON`, `CONTENU_INAPPROPRIE`, `FRAUDE_SUSPECTEE`, `AUTRE`.
  - Statuts : `PENDING_REVIEW` → `APPROVED` | `CHANGES_REQUESTED` | `REJECTED`. Une annonce `CHANGES_REQUESTED` corrigée revient en `PENDING_REVIEW`.
- **Signalements** : `PropertyReport` devient un `ModerationCase` générique (targetType : PROPERTY, MESSAGE, REVIEW, USER, ORGANIZATION), avec assignation à un admin, notes internes et décision. Trois signalements OPEN sur une même cible la mettent automatiquement en `PENDING_REVIEW`.
- **Suspension d'organisation** : annonces passées en `PAUSED` ; nouveaux mandats, baux et réservations bloqués. Les paiements des baux en cours restent possibles (pour ne pas bloquer les locataires), les reversements sont suspendus et les mandants sont notifiés.
- **Impersonation** : token spécial (claim `impersonatedBy`), valable 30 minutes, en lecture seule (le guard bloque toute méthode autre que GET), avec bannière visible et audit.
- **Configuration** : table `PlatformSetting` (clé, valeur JSON, schéma validé), mise en cache 60 s, avec historique des valeurs dans l'audit.

## Modèle de données
```prisma
enum AdminRole { SUPER_ADMIN OPS FINANCE READ_ONLY }
enum ModerationStatus { PENDING_REVIEW APPROVED CHANGES_REQUESTED REJECTED }
enum CaseTarget { PROPERTY MESSAGE REVIEW USER ORGANIZATION }

model AdminProfile {
  userId       String    @id
  role         AdminRole
  totpSecret   String?   // chiffré
  totpEnabledAt DateTime?
  ipAllowlist  String[]
  createdAt    DateTime  @default(now())
}

model AuditLog {
  id          String   @id @default(cuid())
  actorId     String?
  actorType   String   // USER | ADMIN | SYSTEM | PROVIDER
  impersonatedBy String?
  action      String   // ex. "payment.refund.approve"
  targetType  String
  targetId    String
  before      Json?
  after       Json?
  metadata    Json?
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())
  @@index([targetType, targetId])
  @@index([actorId, createdAt])
  @@index([action, createdAt])
}

model Property {
  // + champs
  moderationStatus ModerationStatus @default(PENDING_REVIEW)
  moderationReason String?
  moderationNote   String?
  moderatedById    String?
  moderatedAt      DateTime?
}

model ModerationCase {
  id           String     @id @default(cuid())
  targetType   CaseTarget
  targetId     String
  reports      Json       // [{ reporterId, reason, comment, createdAt }]
  status       String     // OPEN | IN_REVIEW | DISMISSED | ACTIONED
  assignedToId String?
  decision     String?
  internalNotes String?
  createdAt    DateTime   @default(now())
  resolvedAt   DateTime?
}

model PlatformSetting { key String @id value Json updatedById String? updatedAt DateTime @updatedAt }

model SystemAnnouncement { id String @id @default(cuid()) title String body String audience String /* ALL | SEEKERS | MANAGERS */ startsAt DateTime endsAt DateTime? active Boolean @default(true) }

model AppVersionPolicy { platform DevicePlatform @id minVersion String latestVersion String storeUrl String? message String? }
```

## Endpoints
| Méthode | Route | Permission | Description |
|---|---|---|---|
| POST | `auth/admin/totp/setup` · `verify` | admin | 2FA |
| GET | `admin/users` | users.read | **Modifié** : `?q&role&status&countryId&from&to`, paginé |
| GET | `admin/users/:id` | users.read | Fiche 360° |
| POST | `admin/users/:id/suspend` · `unsuspend` | users.suspend | `{ reason }` |
| POST | `admin/users/:id/logout-all` | users.suspend | |
| POST | `admin/users/:id/impersonate` | users.impersonate | Token en lecture seule |
| PUT | `admin/users/:id/admin-role` | admins.manage | `{ role | null }` |
| GET | `admin/organizations` | orgs.read | `?type&affiliationStatus&q` |
| GET | `admin/organizations/:id` | orgs.read | Indicateurs |
| POST | `admin/organizations/:id/approve` · `reject` · `suspend` · `reactivate` | orgs.manage | `{ reason }` |
| GET | `admin/kyc` | kyc.review | File |
| PATCH | `admin/kyc/:id` | kyc.review | `{ status, rejectionReason }` |
| GET | `admin/moderation/properties` | moderation | File `PENDING_REVIEW` |
| PATCH | `admin/properties/:id/moderate` | moderation | **Modifié** : `{ status, reason, note }`, avec notification |
| GET | `admin/cases` | moderation | Tous signalements confondus |
| PATCH | `admin/cases/:id` | moderation | Assignation et décision |
| GET | `admin/payments` | finance.read | Recherche globale |
| GET | `admin/refunds` · PATCH `:id` | finance.refund.approve | |
| GET | `admin/disputes` · PATCH `:id` | finance.dispute | |
| GET | `admin/payouts` · POST `:id/retry` | finance.payout | |
| POST | `admin/reconciliation` · GET `:id` | finance.reconcile | |
| GET | `admin/reports/financial` | finance.read | `?month` : JSON et CSV |
| GET | `admin/audit-logs` | audit.read | Filtres, export CSV |
| GET | `admin/settings` · PUT `:key` | settings.manage | |
| CRUD | `admin/geo/countries\|cities\|arrondissements\|quartiers` | settings.manage | Référentiels |
| CRUD | `admin/announcements` | settings.manage | |
| PUT | `admin/app-versions/:platform` | settings.manage | |
| GET | `app/config` | public | Annonces actives, version minimale, feature flags publics (utilisé par le mobile) |
| GET | `admin/stats` | stats.read | **Modifié** : KPI avec séries temporelles `?from&to&granularity` |

## Écrans (web admin)
- `/admin/dashboard` : KPI, courbes et alertes (litiges escaladés, reversements échoués, files en attente).
- `/admin/users` : recherche et filtres. `/admin/users/[id]` : fiche 360° avec actions.
- `/admin/organizations` et `/admin/organizations/[id]`, plus `/admin/kyc`.
- `/admin/moderation` : file avec aperçu de l'annonce, motifs et historique. `/admin/cases`.
- `/admin/finance` : onglets Paiements, Remboursements, Litiges, Reversements, Rapprochement, Rapports.
- `/admin/support` : conversations SUPPORT (10).
- `/admin/notifications` (11).
- `/admin/config` : remplacer la page en lecture seule par l'édition des paramètres, référentiels géographiques, annonces système, versions de l'app, CGU et feature flags.
- `/admin/audit` : journal.
- `/admin/admins` : gestion des comptes admin (SUPER_ADMIN).

## Critères d'acceptation
- Un admin `OPS` qui appelle `admin/refunds/:id` reçoit 403.
- Toute route `admin/*` sans TOTP validé dans la session renvoie 401 `TOTP_REQUIRED`.
- Modérer une annonce en `REJECTED` sans motif renvoie 400. Avec motif, le propriétaire reçoit une notification `LISTING_MODERATED` contenant ce motif.
- Chaque action admin crée exactement une entrée `AuditLog`, avec `before` et `after` (test sur suspend, moderate, refund).
- Un token d'impersonation sur une route POST renvoie 403. La bannière est affichée sur le web.
- Modifier `stay.serviceFeeRate` dans la configuration impacte les nouveaux devis en moins de 60 s, sans changer les réservations existantes.
- `GET app/config` renvoie `minVersion`. Le mobile force la mise à jour si la version installée est inférieure.
- La recherche `admin/users?q=0612` trouve par téléphone partiel.

## Priorité
- **P0** : suspension d'utilisateur, motif et notification de modération, 2FA admin, audit log des actions financières et admin.
- **P1** : recherche et fiche 360°, affiliation et KYC, suspension d'organisation, finance admin, RBAC admin, `ModerationCase` générique, suivi du déclarant, configuration éditable, référentiels géographiques.
- **P2** : impersonation, détection de doublons et fraude, annonces système, force update, KPI avancés.
