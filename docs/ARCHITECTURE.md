# Architecture générale

## Portée et statut

Carte de navigation de Paradis Immo, fondée sur la structure locale du dépôt au 2026-10-16. Elle décrit l'architecture observée, pas la complétude fonctionnelle ni la disponibilité en production. Pour les exigences métier, consulter [les specs](specs/README.md).

## Système

```text
                 ┌────────────────────────────┐
                 │ Site public Next.js         │
                 │ apps/web                     │
                 └──────────────┬─────────────┘
                                │ HTTPS / JSON
┌────────────────────────────┐  │  ┌────────────────────────────┐
│ Portail de gestion Next.js │──┼─▶│ API NestJS                 │
│ owner / agent / admin      │     │ apps/api                   │
└────────────────────────────┘     └──────┬───────────┬─────────┘
                                          │           │
┌────────────────────────────┐            │           ├── R2 / stockage médias
│ App client Expo            │────────────┘           ├── OTP / push / email
│ apps/mobile                │                        └── Paiements externes
└────────────────────────────┘
                                          │
                                    PostgreSQL
                                    Prisma ORM
```

Le dépôt est un monorepo logique à trois applications. Les contrats HTTP de l'API sont le point de liaison principal ; les types OpenAPI générés dans les clients sont des artefacts, non la source métier. Les services externes dépendent de leur configuration et de leurs identifiants d'environnement.

## Applications et frontières

| Application | Responsabilité observée | Sources à consulter |
|---|---|---|
| `apps/api` | API NestJS, règles métier, auth, accès, persistance Prisma, événements et tâches planifiées | `src/main.ts`, `src/app.module.ts`, `src/<domaine>/`, `prisma/schema.prisma` |
| `apps/web` | Site public et portail authentifié de gestion; appels API via `lib/api.ts`; session web NextAuth | `app/`, `auth.ts`, `lib/`, `middleware.ts` |
| `apps/mobile` | App client Expo/React Native; appels API via `lib/api.ts`; session OTP | `app/`, `lib/`, `context/`, `types/` |

Les parcours privés client final appartiennent à l'application mobile ; le site public permet la découverte et la consultation. Les routes `owner`, `agent` et `admin` du web sont des surfaces de gestion. Les rôles et permissions effectifs doivent toujours être vérifiés côté API : masquer une page ou un bouton n'est pas une autorisation.

## Domaines métier

L'API est organisée par domaines NestJS sous `apps/api/src/`. Les principaux agrégats métier sont :

| Domaine | Dossiers API | Objets / responsabilités |
|---|---|---|
| Identité et accès | `auth`, `account`, `users`, `admin`, `common` | Utilisateurs, OTP, sessions, rôles et gardes |
| Organisation et portefeuille | `organizations`, `mandates`, `properties`, `locations`, `media` | Agences, membres, mandats, annonces et fichiers |
| Parcours immobiliers | `applications`, `leases`, `tenants`, `visit-slots`, `bookings`, `sales` | Candidatures, baux, visites, séjours, demandes et dossiers de vente |
| Argent | `payments`, `accounting`, `deposits`, `payouts` | Encaissements, allocations, ledger, caution, reversements et rapprochement |
| Exploitation métier | `maintenance`, `messaging`, `notifications`, `favorites`, `reports` | Incidents, conversations, notifications et signalements |
| Configuration / pilotage | `owner`, `agent`, `platform-config`, `events`, `health` | Vues de gestion, paramètres, événements et santé |

Les dépendances exactes entre domaines sont définies dans les modules Nest et les relations Prisma. Ne pas ajouter une seconde source de vérité à partir de cette liste.

## Flux transverses

### Requête API

1. Le client construit une requête vers `NEXT_PUBLIC_API_URL` (web) ou `EXPO_PUBLIC_API_URL` (mobile).
2. L'API applique le préfixe `api/v1` ; `GET /health` est exclu du préfixe.
3. La validation globale transforme les DTOs, rejette les champs inconnus et applique les filtres/guards du contrôleur.
4. La règle métier et l'accès aux ressources sont appliqués dans le domaine API.
5. Prisma persiste les données PostgreSQL ; la réponse JSON utilise l'enveloppe API, avec `data` et, pour certaines listes, `meta`.

La forme exacte de chaque endpoint est celle du contrôleur/DTO et de l'OpenAPI généré, pas une forme supposée uniforme par tous les endpoints.

### Authentification

- Mobile : OTP côté API, access/refresh tokens côté app ; les tokens sont stockés via Expo SecureStore dans le code courant.
- Web de gestion : session JWT NextAuth côté serveur/client, avec tokens backend et renouvellement via l'API.
- Les stratégies, guards et rôles de l'API sont l'autorité. Ne pas transmettre de secrets backend au navigateur ou à l'application mobile.
- Voir les sources actuelles dans `apps/api/src/auth/`, `apps/web/auth.ts` et `apps/mobile/lib/auth.ts`.

### Événements et notifications

Les producteurs d'événements métier se trouvent dans leurs domaines et les processors/listeners sous `events` ou `notifications`. Un événement émis ne garantit pas qu'un handler existe : pour chaque événement, vérifier son listener, son retry/idempotence, son canal et son test. La spec 11 décrit l'état cible et les écarts connus.

### Fichiers et documents

Le domaine `media` gère les médias et le stockage configuré (dont R2). Les pièces privées exigent une autorisation API et un stockage privé ; une URL publique ne constitue pas une protection. Vérifier [le runbook de stockage](checklists/verification-stockage-prive.md) et la spec 16 avant toute migration ou mise en production.

## Déploiement et environnements

- `docker-compose.yml` fournit PostgreSQL local.
- `render.yaml` décrit le service API Render ; les clients web/mobile ont leurs propres configurations et builds.
- Les valeurs de production et secrets sont définis dans les consoles d'hébergement, jamais committés.
- Le schéma PostgreSQL et ses migrations vivent dans `apps/api/prisma/`.

Cette documentation ne confirme pas quel commit est déployé, si les migrations de production sont à jour, ni si les credentials de fournisseurs fonctionnent.

## Navigation approfondie

- [Architecture API](architecture/api.md)
- [Architecture web et mobile](architecture/clients.md)
- [Index et statuts des docs](README.md)
- [Préparation au lancement](specs/16-preparation-lancement-et-exigences-transverses.md)
