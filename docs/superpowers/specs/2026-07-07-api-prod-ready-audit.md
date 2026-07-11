# Paradis Immo API — Audit qualité prod-ready

**Date :** 2026-07-07
**Statut :** Rapport — en attente de revue utilisateur
**Périmètre :** `apps/api` (NestJS 11, Prisma 7, PostgreSQL 16, Redis, BullMQ, R2)
**Méthode :** 4 passes (inventaire statique, audit dimensionnel 9+1 dimensions, audit transversal, priorisation)

## Résumé exécutif

| Sévérité | Compte | Thèmes |
|---|---|---|
| **P0** bloquant prod | **4** | (1) `MediaModule` non enregistré dans `AppModule` → 3 routes upload inaccessibles, (2) IDOR sur `GET /receipts/:id`, (3) CORS `origin: '*'` en prod, (4) endpoint `GET /properties/mine` manquant (bloque plan web T1) |
| **P1** à corriger sous 1 sprint | **8** | Endpoints `mine/managed` manquants (5), Swagger quasi vide, e2e manquants sur 4 flows critiques (payment, lease, visit, mandate), healthcheck DB/Redis, cohérence du filtre `listMine` maintenance |
| **P2** dette à planifier | **6** | Index DB manquants (`Property.ownerId`, `Payment.userId`, etc.), `findMany` sans `take` par défaut, message d'erreur de la 404 properties, etc. |
| **P3** backlog | **4** | Logging structuré request-id, métriques, polish Swagger (exemples DTO), i18n messages FR |

**Verdict global** : l'API est **solide sur les fondations** (RBAC explicite, transactions, idempotence, refresh rotation, validation DTO généralisée, `Logger` Nest utilisé) mais a **4 trous bloquants** qui empêchent de la déclarer prod-ready. Le fix des P0 tient en 1 à 2 jours ; le P1 en 1 sprint.

## Méthode

### Sources de vérité lues

| # | Document | Apport |
|---|---|---|
| 1 | `docs/superpowers/specs/2026-06-27-paradis-immo-design.md` | Modules, schéma DB, règles métier |
| 2 | `docs/superpowers/specs/2026-07-04-web-mvp-product-design.md` | Endpoints attendus côté web |
| 3 | `docs/superpowers/plans/2026-07-04-web-mvp-product-plan.md` (T1, T5, T7) | Endpoints à ajouter : `properties/mine`, `leases/managed`, `bookings/managed`, `payments/managed`, `properties/:id/media/presign` + `confirm` |
| 4 | `apps/api/prisma/schema.prisma` | Modèle de données |
| 5 | `apps/api/src/**/*.controller.ts` + `*.service.ts` | Routes et logique effectives |
| 6 | `docs/superpowers/specs/2026-06-29-paradis-immo-testing-policy.md` | Flows e2e obligatoires |

### Outils

- `Read` ciblé sur les fichiers de chaque module
- `Grep` pour `@UseGuards`, `@Roles`, `@OrganizationContext`, `findMany(`, `console.log`, `TODO`, `: any`, `@ApiTags`
- Pas de sous-agent (maîtrise complète du rapport)
- Audit read-only : aucune modification de code

---

## 1. Sécurité / RBAC

### Constats positifs

- `@UseGuards(AppAuthGuard)` ou `JwtAuthGuard` sur **tous** les contrôleurs non publics (vérifié par grep)
- `AdminController` est le seul à combiner `AppAuthGuard + RolesGuard + @Roles('PLATFORM_ADMIN')` (ligne 31-32) — pattern correct
- Vérifications de propriété explicites dans les services critiques :
  - `properties.service.ts:303 assertCanWrite` — ownerId ou org member
  - `leases.service.ts:73, 134` — owner ou org member pour create/activate
  - `mandate-approval.service.ts:105` — owner du bien décide l'approbation
  - `payments.service.ts` — `validateCashPayment` ne vérifie pas l'autorisation côté agent (voir finding P1-6)

### Findings

| # | Module | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|---|
| S-1 | receipts | `payments/receipts/receipt.controller.ts:21-24` | **P0** | **IDOR** : l'auteur a marqué explicitement le trou : « a full implementation would check that `current.userId` owns the payment, or is an AGENT/ADMIN on the related property. For MVP we trust the JWT + the receipt's opaque id. » Un attaquant avec un JWT valide peut télécharger le reçu d'un paiement qui n'est pas le sien. | Vérifier dans `findOne` que `current.userId` est `payment.userId` OU membre `AGENT/ADMIN` de l'org de la propriété liée au bail. Ajouter un test e2e. |
| S-2 | payments | `payments.controller.ts:69 POST /payments/:id/validate` | **P1** | `validateCashPayment` ne vérifie pas que `current.userId` est bien un `AGENT/ADMIN` de l'org propriétaire de la propriété liée au bail. Théoriquement un tenant authentifié pourrait valider son propre paiement cash. | Ajouter un check `OrgContextGuard` ou assertion manuelle dans le service. |
| S-3 | properties | `properties.controller.ts:39 GET /properties/:id` | **P3** | La route est publique. Une propriété `DRAFT` ou `PAUSED` peut être lue par n'importe qui via id. | Filtrer le `where` : si `status IN ('DRAFT','PAUSED')` → 404. Ou exiger auth + ownership. |
| S-4 | locations | `locations.controller.ts` (toute la classe) | **P3** | Endpoints publics sans rate limiting — un attaquant peut énumérer villes/quartiers. | Ajouter `ThrottlerGuard` global ou par contrôleur. |

---

## 2. Validation des entrées

### Constats positifs

- `app.module.ts` active `ValidationPipe({ whitelist: true, transform: true })` (`main.ts:22-27`)
- DTO d'entrée typés avec `class-validator` sur **tous** les contrôleurs (aucun `@Body() body: any`)
- `ParseIntPipe` + `DefaultValuePipe` + bornes `Math.max/Math.min` dans `admin.controller.ts:43-50`
- UUID validés via `@IsUUID` (`maintenance.controller.ts:24`, `sales.controller.ts:19`)

### Findings

| # | Module | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|---|
| V-1 | leases | `leases.controller.ts:18-26 CreateLeaseDto` | **P2** | DTO défini inline dans le contrôleur (pas dans `dto/`). Manque `@IsUUID` sur `propertyId` et `tenantId`, `@Min(0)` sur `monthlyRent` et `deposit`, validation du format `currency` (ISO 4217). | Déplacer dans `dto/create-lease.dto.ts`, ajouter UUID + bornes + `@Length(3,3)` sur currency. |
| V-2 | bookings | `bookings.controller.ts:20-24 CreateBookingDto` | **P2** | DTO inline, pas de validation que `endDate > startDate` (couvert dans le service mais en 400 post-insert potentiel), pas de `@Min(0)` sur les dates, pas de `guests` ni de validation de chevauchement côté DTO. | Déplacer + ajouter validations. |
| V-3 | visit-slots | `visit-slots.controller.ts:27-32 CreateTemplateDto` | **P2** | `startTime` et `endTime` validés par regex mais pas que `endTime > startTime` (le générateur le fait, mais on devrait rejeter en 400 plus tôt). | Ajouter validateur custom `@IsTimeRange`. |
| V-4 | mandates | `mandates.controller.ts:24-27 DecideApprovalDto` | **P2** | `approve!: boolean` sans `@IsBoolean()`. Si un client envoie `{ approve: "yes" }`, la conversion TypeScript peut passer en `true`. | Ajouter `@IsBoolean()`. |

---

## 3. Gestion d'erreurs

### Constats positifs

- `HttpExceptionFilter` global (`main.ts:32`, `common/filters/http-exception.filter.ts`) — uniformise `{ code, message, details }`
- Codes métier explicites (`OTP_INVALID`, `PROPERTY_NOT_FOUND`, `LEASE_TERMINATED`, etc.) — pas de messages génériques
- `HttpException` typés : `NotFoundException`, `ForbiddenException`, `BadRequestException`, `UnauthorizedException` partout
- Pas de `throw new Error('...')` exposé au client (les 2 `throw new Error` dans `properties.service.ts:352,358` sont des erreurs internes — défensives sur un include chain cassé)

### Findings

| # | Module | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|---|
| E-1 | properties | `properties.service.ts:352,358` | **P3** | `throw new Error('...include chain broken')` n'est pas un `HttpException` — passe au travers du filter et renvoie un 500 avec stack trace en dev. | Remplacer par `InternalServerErrorException` avec code `INTERNAL_INCLUDE_BROKEN`. |
| E-2 | properties | `properties.service.ts:131 getOne` | **P2** | Retourne `404` avec `code: 'PROPERTY_NOT_FOUND'` pour une propriété `DRAFT/PAUSED/ARCHIVED` lue publiquement. Comportement discutable (cf. S-3). | Décider la politique : 404 total ou 403 selon le statut. |
| E-3 | receipts | `receipt.controller.ts:18-20` | **P2** | `if (!receipt) return { code: 'RECEIPT_NOT_FOUND', message: 'Receipt not found' };` retourne **200** au lieu de 404. | Lever une `NotFoundException`. |
| E-4 | main | `main.ts:38-39` | **P3** | `console.log` au boot. Pas critique, mais Logger Nest serait plus propre et structured. | Remplacer par `Logger.log` du contexte bootstrap. |

---

## 4. Auth & sessions

### Constats positifs

- OTP avec TTL 5 min (`otp.store.ts:10`) et max 5 tentatives (`auth.service.ts:13`)
- Codes OTP distincts : `OTP_NOT_FOUND` (pas demandé), `OTP_INVALID` (mauvais code), `OTP_LOCKED` (trop de tentatives)
- Refresh token rotation : ancien révoqué avant émission du nouveau (`auth.service.ts:116-121`)
- Refresh token hashé en SHA-256 avant stockage (`auth.service.ts:206-208`)
- JWT access 15 min, refresh 30 jours
- `AppAuthGuard` composite qui bascule en `TestAuthGuard` en NODE_ENV=test (utile pour les e2e)

### Findings

| # | Module | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|---|
| A-1 | jwt | `jwt.strategy.ts:16` | **P2** | `secretOrKey: process.env.JWT_SECRET ?? 'dev-only-change-me'`. Si la variable n'est pas définie en prod, l'app démarre avec un secret codé en dur. | Fail-fast au boot : `if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') throw new Error(...)`. |
| A-2 | auth | `auth.service.ts:51 requestOtp` | **P2** | Pas de rate limit sur `/auth/otp/request`. Un attaquant peut spammer un numéro pour bombarder la cible d'OTP WhatsApp (coût + nuisance). | Ajouter un compteur par numéro (Redis) avec TTL 1h : max 5 OTP/h. |
| A-3 | auth | `auth.service.ts:201 generateCode` | **P3** | `Math.random()` pour générer le code. Pas cryptographiquement sûr (un attaquant qui observe quelques codes peut prédire les suivants en principe). Faible en pratique (6 chiffres = 1M combinaisons, brute force impossible grâce au rate limit), mais à corriger pour la propreté. | Remplacer par `crypto.randomInt(100000, 1000000)`. |
| A-4 | auth | `auth.service.ts:89 refresh` | **P3** | Pas de rate limit sur `/auth/refresh`. | Ajouter throttling. |

---

## 5. Couverture fonctionnelle (endpoints attendus vs existants)

### Matrice endpoint par module

| Module | Endpoints présents | Endpoints manquants (design spec + plan web) | Sévérité manquants |
|---|---|---|---|
| **auth** | `POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/refresh` | Complet | — |
| **users** | `GET /users/me`, `PATCH /users/me`, `GET /users/me/organizations` | Complet (cf. P1-1 pour `/me/organizations`) | P1 (cf. plus bas) |
| **locations** | `GET /locations/cities`, `/arrondissements`, `/quartiers` | Complet | — |
| **properties** | `GET /properties`, `GET /properties/:id`, `POST`, `PATCH`, `POST :id/archive` | `GET /properties/mine` | **P0** (cf. F-1) |
| **media** | `GET /properties/:id/media`, `POST /presign`, `POST /confirm` | Routes inaccessibles (cf. P0-1) | **P0** (cf. P0-1) |
| **visit-slots** | `POST/PATCH/GET /properties/:id/visit-templates`, `POST /visit-slots/block`, `GET /visit-slots`, `POST /visits`, `GET /visits/my`, `GET /visits/managed`, `PATCH /visits/:id/confirm\|cancel` | Complet | — |
| **bookings** | `GET /properties/:id/availability`, `POST /bookings`, `GET /bookings/my`, `PATCH /bookings/:id/cancel` | `GET /bookings/managed` (cf. P1-2) | P1 |
| **leases** | `POST /leases`, `PATCH :id/activate`, `GET :id/schedule` | `GET /leases/managed` (cf. P1-3) | P1 |
| **sales** | `POST /sales/inquiries`, `GET /sales/inquiries/my`, `GET /sales/inquiries/managed`, `PATCH /:id/status` | Complet | — |
| **maintenance** | `POST /maintenance/tickets`, `GET /tickets/my`, `GET /tickets`, `PATCH :id`, `PATCH :id/assign` | `GET /maintenance/tickets/managed` (pour owners + agents) | P1 |
| **mandates** | `POST /mandates`, `GET /mandates/pending-approvals`, `PATCH /mandates/approvals/:id` | Complet | — |
| **payments** | `POST /payments`, `POST :id/validate`, `GET /payments/my`, `GET /payments/pending-validation`, `POST /payments/webhooks/mobile-money` | `GET /payments/managed` (cf. P1-4) | P1 |
| **receipts** | `GET /receipts/:id` | Complet (mais IDOR, cf. S-1) | — |
| **admin** | `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/properties/:id/moderate` | Complet | — |
| **health** | `GET /health` | Doit aussi sonder DB+Redis (cf. P1-5) | P1 |

### Findings

| # | Sévérité | Description | Source |
|---|---|---|---|
| F-1 | **P0** | `GET /properties/mine` manquant — bloque plan web T1. | Plan web T1 |
| F-2 | **P0** | Routes `/properties/:id/media/*` **inaccessibles** car `MediaModule` n'est pas dans `app.module.ts:19-39`. Voir P0-1. | Inspection `app.module.ts` |

---

## 6. Observabilité

### Constats positifs

- `Logger` Nest utilisé dans tous les services (`auth`, `events`, `organizations`, `notifications`, `payments/receipts`)
- `EventPublisher` logge les jobs `completed` et `failed` (`event.publisher.ts:82,85`)
- Pas de `console.log` sauf 2 dans `main.ts` (boot)

### Findings

| # | Module | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|---|
| O-1 | global | — | **P1** | Aucun middleware de request-id ni correlation-id. Impossible de tracer une requête à travers les logs. | Ajouter un `RequestIdMiddleware` (génère UUID, attache à `req.id`, l'inclut dans chaque log via un logger custom ou `pino-http`). |
| O-2 | health | `health.controller.ts` | **P1** | `/health` ne vérifie ni la DB ni Redis. Si Postgres tombe, l'API répond 200. | Ajouter un health check qui ping `prisma.$queryRaw('SELECT 1')` et `redisClient.ping()`. |
| O-3 | global | — | **P3** | Pas de métriques (Prometheus ou similaire). | Ajouter `@willsoto/nestjs-prometheus` ou équivalent (P3 — non bloquant). |

---

## 7. Documentation Swagger

### Constats positifs

- Swagger configuré (`main.ts:33-41`) avec Bearer auth
- OpenAPI JSON exportable via `pnpm export:openapi`

### Findings

| # | Module | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|---|
| S-1 | global | tous les contrôleurs | **P1** | **Aucun `@ApiTags`, `@ApiOperation`, `@ApiResponse` sur les contrôleurs.** L'OpenAPI généré ne contient que les schémas Prisma, pas de description ni de tags. Conséquence : `apps/web` (qui regen les types via `generate-types.mjs`) a des types fonctionnels mais aucune doc humaine. | Ajouter `@ApiTags('Module')` par contrôleur, `@ApiBearerAuth()` par route protégée, `@ApiOperation({ summary: '...' })` par route. Cible : ≥90% des routes en P1. |
| S-2 | global | DTO | **P3** | Pas d'`@ApiProperty({ example: ... })` sur les DTO. Exemples côté Swagger vides. | Ajouter des exemples. |

---

## 8. Tests

### Constats positifs

- 22 fichiers `*.spec.ts` (un par module sauf `common`, `prisma`, `health`)
- Tests e2e : `auth`, `users`, `events`, `health` (4 fichiers)
- Tests d'intégration soignent RBAC : `payments.spec.ts` (337 lignes), `properties.spec.ts` (276 lignes), `bookings.spec.ts` (290 lignes)
- Test policy documentée et appliquée : API-only, pas de tests frontend

### Findings

| # | Module | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|---|
| T-1 | payments | `apps/api/test/` | **P1** | **Pas d'e2e sur le flow paiement cash** (créer payment → valider → receipt PDF) malgré la testing policy qui le liste comme « Critical flow ». | Ajouter `payments.e2e-spec.ts`. |
| T-2 | leases | `apps/api/test/` | **P1** | **Pas d'e2e sur lease activation → rent schedule generation**. | Ajouter `leases.e2e-spec.ts`. |
| T-3 | mandates | `apps/api/test/` | **P1** | **Pas d'e2e sur mandate approval blocking lease activation**. | Ajouter `mandates.e2e-spec.ts`. |
| T-4 | visit-slots | `apps/api/test/` | **P1** | **Pas d'e2e sur visit booking (free + paid) + overlap rejection**. | Ajouter `visits.e2e-spec.ts`. |
| T-5 | properties | `properties.spec.ts` | **P2** | Le test ne couvre pas explicitement l'IDOR sur `update` et `archive` par un user non-owner. | Ajouter un test : user B essaie de `PATCH /properties/<id de A>` → 403. |
| T-6 | maintenance | `maintenance.service.ts:221 listMine` | **P1** | `listMine` retourne les tickets où `reporterId = userId`. Mais un owner doit aussi voir les tickets sur SES propriétés, pas seulement ceux qu'il a déclarés. Sémantique ambiguë : `my` ≠ `for my properties`. | Renommer en `listReportedByMe` OU introduire `listForMyProperties` (alias managed) — clarifier la spec. |

---

## 9. Performance & DB

### Constats positifs

- `properties.list` : `Promise.all([findMany, count])` (`properties.service.ts:179-188`) — bon pattern
- `Decimal` Prisma utilisé partout — pas de `Number` sur des montants
- `include` Prisma bien utilisé pour éviter N+1 (`properties.publicInclude`, `leases.service.ts:124`)

### Findings

| # | Module | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|---|
| P-1 | prisma | `schema.prisma` | **P2** | **Aucun index explicite** sur les colonnes filtrées/triées : `Property.ownerId`, `Property.organizationId`, `Payment.userId`, `VisitBooking.userId`, `Lease.tenantId`, `MaintenanceTicket.propertyId`. | Ajouter `@@index` sur ces colonnes. Migration Prisma. |
| P-2 | payments | `payments.service.ts:242 listMyPayments` | **P2** | `findMany` sans `take` explicite. Un utilisateur avec 10 000 paiements charge tout. | Ajouter `take` (défaut 50) + `cursor` pour la pagination, ou un `findMany` avec `take: 100` max + un compteur. |
| P-3 | bookings | `bookings.service.ts` (et similaires) | **P2** | `listMyBookings` sans `take` | Idem P-2. |
| P-4 | sales | `sales.service.ts listInquiriesForBuyer` | **P2** | Idem | Idem P-2. |
| P-5 | maintenance | `maintenance.service.ts:221 listMine` | **P2** | Idem | Idem P-2. |
| P-6 | leases | `leases.service.ts:189 getSchedule` | **P3** | `findMany` sans `take`. Un bail de 10 ans = 120 mois = OK, mais un bail 30 ans = 360 → envisager une borne. | Ajouter `take: 360` (30 ans) pour se protéger. |

---

## 10. Idempotence & cohérence

### Constats positifs

- `payments.initiatePayment` : check `idempotencyKey` avant create (`payments.service.ts:76-80`) — pattern correct
- `leases.activateLease` : idempotent sur re-run grâce à `@@unique([leaseId, dueDate])` (`leases.service.ts:118`)
- `rentSchedule.generateForLease` : `upsert` ou `createMany` avec `skipDuplicates` (à vérifier — non lu dans le détail)
- `properties.archive` : no-op si déjà `ARCHIVED` (`properties.service.ts:287-289`)
- `payments.validateCashPayment` : no-op si déjà `VALIDATED` (`:136-138`)

### Findings

| # | Module | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|---|
| I-1 | leases | `leases.service.ts:161` | **P2** | `tx.lease.update` est dans une transaction, mais la génération du rent schedule est **hors transaction** (ligne 173). En cas d'erreur entre les deux, on a un lease `ACTIVE` sans schedule. | Englober la génération dans la transaction (ou la décorréler via un event `LEASE_CREATED` que le processor `rent-schedule` écoute — ce que le code fait déjà peut-être, à vérifier). |
| I-2 | mandates | `mandate-approval.service.ts:118` | **P2** | `decideApproval` n'est pas transactionnel avec l'effet de bord (création/modification du bail sous-jacent). | Encapsuler dans `$transaction`. |
| I-3 | payments | `payments.service.ts:147-177` | **P2** | `validateCashPayment` est transactionnel ✅. Mais si l'event `PAYMENT_VALIDATED` échoue après le commit, on a un paiement validé sans notification. | Le pattern BullMQ est déjà en place — vérifier que c'est bien outbox-pattern (re-émission en cas d'échec). |

---

## Audit transversal

### CORS et headers

| # | Fichier:ligne | Sévérité | Description | Recommandation |
|---|---|---|---|---|
| C-1 | `main.ts:14-18` | **P0** | `app.enableCors({ origin: '*' })` — trop permissif pour prod. Accepte les requêtes cross-origin depuis n'importe quel domaine. | Restreindre à une whitelist (`process.env.ALLOWED_ORIGINS.split(',')`). En dev, garder `*`. |
| C-2 | `main.ts` | **P2** | Pas de `helmet` (headers de sécurité : `X-Frame-Options`, `Strict-Transport-Security`, `Content-Security-Policy`, etc.). | Ajouter `helmet` middleware. |
| C-3 | `main.ts` | **P2** | Pas de rate limiting global (NestJS `@nestjs/throttler`). | Ajouter `ThrottlerModule` avec 100 req/min par IP par défaut. |

### Variables d'environnement

| # | Sévérité | Description |
|---|---|---|
| E-1 | **P1** | `.env.example` à la racine inclut toutes les vars attendues, mais ne signale pas les vars **obligatoires** vs **optionnelles**. Pas de validation au boot (ex. `class-validator` sur env, ou `joi`/`zod`). |
| E-2 | **P1** | `apps/api/.env.example` n'existe pas (seulement `.env.example` à la racine). Confusion possible. |

### OpenAPI sync

| # | Sévérité | Description |
|---|---|---|
| A-1 | **P1** | `apps/api/openapi.json` n'est pas commité. Impossible de savoir s'il est à jour sans lancer `pnpm export:openapi`. |
| A-2 | **P2** | `scripts/generate-types.mjs` (web) dépend de ce fichier ; sans le committer, le workflow est fragile. |

---

## Synthèse des P0

| ID | Titre | Effort estimé |
|---|---|---|
| **P0-1** | Enregistrer `MediaModule` dans `AppModule` | 5 min |
| **P0-2** | Ajouter RBAC sur `GET /receipts/:id` | 30 min + test |
| **P0-3** | Restreindre CORS en prod | 15 min + var d'env |
| **P0-4** | Ajouter `GET /properties/mine` (avec `take`, `orderBy`, `status` filter) | 1 h + test + commit |

**Total P0 estimé** : ~2-3 heures, tenant en 1 jour.

## Synthèse des P1 (lots cohérents pour le plan)

| Lot | Findings | Effort |
|---|---|---|
| **L1 — Endpoints managed/mine** | F-1 (mine), P1-1 (`/users/me/organizations` existe, à confirmer), P1-2 (`/bookings/managed`), P1-3 (`/leases/managed`), P1-4 (`/payments/managed`), P1 maintenance (T-6) | 1-2 jours |
| **L2 — Swagger** | S-1 + S-2 | 0,5-1 jour |
| **L3 — E2E manquants** | T-1, T-2, T-3, T-4 | 2-3 jours |
| **L4 — Observabilité** | O-1 (request-id), O-2 (health DB+Redis) | 1 jour |
| **L5 — Sécurité globale** | S-2 (RBAC validate cash), C-2 (helmet), C-3 (throttler), E-1/E-2 (env validation) | 1-2 jours |
| **L6 — DTO inline** | V-1, V-2, V-3, V-4 | 0,5 jour |

**Total P1 estimé** : 7-10 jours (1 sprint).

---

## Annexe : matrice endpoint

Cf. section 5 ci-dessus (intégrée directement).

## Annexe : fichiers de test existants

| Fichier | Lignes | Couverture |
|---|---|---|
| `apps/api/src/admin/admin.controller.spec.ts` | 337 | Bon — RBAC, pagination |
| `apps/api/src/auth/auth.service.spec.ts` | 107 | OK — OTP, refresh |
| `apps/api/src/bookings/bookings.spec.ts` | 290 | Bon |
| `apps/api/src/events/event.publisher.spec.ts` | 80 | OK |
| `apps/api/src/leases/leases.spec.ts` | 212 | Bon — RBAC, transactions |
| `apps/api/src/locations/locations.spec.ts` | 106 | OK |
| `apps/api/src/maintenance/maintenance.spec.ts` | 300 | Bon |
| `apps/api/src/mandates/mandates.spec.ts` | 208 | Bon — RBAC explicite |
| `apps/api/src/media/media.spec.ts` | 285 | Bon (mais module non enregistré) |
| `apps/api/src/notifications/notifications.spec.ts` | 286 | Bon |
| `apps/api/src/organizations/organizations.service.spec.ts` | 94 | OK |
| `apps/api/src/payments/payments.spec.ts` | 337 | Très bon — idempotence, transactions |
| `apps/api/src/properties/properties.spec.ts` | 276 | Bon — RBAC, mode change |
| `apps/api/src/sales/sales.spec.ts` | 272 | Bon |
| `apps/api/src/scripts/codegen.spec.ts` | 78 | OK |
| `apps/api/src/users/users.service.spec.ts` | 96 | OK |
| `apps/api/src/visit-slots/slot-generator.spec.ts` | 267 | Bon |
| `apps/api/src/visit-slots/visit-bookings.spec.ts` | 309 | Bon |

**Total** : 18 fichiers de tests unitaires/intégration, ~4 250 lignes. Couverture qualitative **élevée** sur les modules critiques (paiements, propriétés, mandats, baux).

## Annexe : fichiers e2e existants

| Fichier | Flow couvert |
|---|---|
| `apps/api/test/auth.e2e-spec.ts` | OTP request, verify (wrong + correct), refresh + rotation |
| `apps/api/test/users.e2e-spec.ts` | Users |
| `apps/api/test/events.e2e-spec.ts` | Events |
| `apps/api/test/health.e2e-spec.ts` | Health basique |

**Manquants** : `payments.e2e-spec.ts`, `leases.e2e-spec.ts`, `mandates.e2e-spec.ts`, `visits.e2e-spec.ts` — 4 flows critiques de la testing policy.
