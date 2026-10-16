# Architecture API

## Périmètre

Guide de navigation de l'API NestJS locale. La source de vérité reste `apps/api/src/`, le schéma Prisma et les contrats contrôleur/DTO. Les fonctionnalités listées ici sont des domaines de code, pas une affirmation de préparation à la production.

## Entrée et configuration HTTP

- Bootstrap : `apps/api/src/main.ts`.
- Composition des domaines : `apps/api/src/app.module.ts`.
- Préfixe versionné : `/api/v1`; `GET /health` reste à `/health`.
- OpenAPI/Swagger : `/api/v1/docs`.
- Validation globale : whitelist activée, champs inconnus rejetés, conversion implicite activée.
- Réponses : filtre global dans `common/filters/http-exception.filter.ts`; inspecter le filtre pour le format précis des erreurs.
- CORS : `ALLOWED_ORIGINS`, avec origines de développement et URL web définies par défaut dans le bootstrap.
- Throttling global : limite déclarée dans `AppModule`; vérifier les limites spécifiques à une route avant d'en déduire le comportement d'un endpoint.

## Carte des domaines

| Dossier | Responsabilité principale | Repères |
|---|---|---|
| `auth/`, `account/`, `users/` | OTP, sessions et opérations de compte | `auth.controller.ts`, `account/`, guards |
| `organizations/`, `mandates/` | Organisations, adhésions, accès opérable | `agency-access.service.ts`, services/controllers |
| `properties/`, `locations/`, `media/` | Catalogue de biens, géographie et stockage | DTO filtres, `media/` |
| `visit-slots/`, `bookings/` | Visites et réservations de séjours | services, contrôleurs, specs 06–07 |
| `applications/`, `leases/`, `tenants/`, `deposits/` | Dossiers locatifs, bail, documents, caution | schéma et transitions métier |
| `sales/` | Demandes de vente, offres, dossiers et échéances | `sales.controller.ts`, sous-services |
| `payments/`, `accounting/`, `payouts/` | Paiements, allocations, ledger et reversements | providers, processors et ledger |
| `maintenance/`, `messaging/`, `notifications/` | Tickets, conversations et communications | contrôleurs et processors |
| `owner/`, `agent/`, `admin/` | Vues de gestion et administration plateforme | services de stats et guards |
| `events/`, `platform-config/`, `health/` | Événements, paramètres, santé | modules transverses |

### Conventions de domaine

- Le contrôleur porte le contrat HTTP et la délégation ; la règle métier se trouve généralement dans le service du domaine.
- Les DTOs valident les entrées et sont l'endroit à vérifier pour les champs autorisés et conversions.
- Les accès aux biens gérés doivent s'aligner sur `AgencyAccessService` et le périmètre effectivement défini par le domaine ; ne pas déduire l'autorisation d'un `organizationId` fourni par l'appelant.
- Les changements d'état métier doivent être examinés avec leurs transactions Prisma, contraintes d'unicité, événements et tests de concurrence.
- Les jobs planifiés sont activés via `ScheduleModule`; rechercher le processor/crontab réel avant de conclure qu'une tâche fonctionne.

## Données et persistance

- Schéma : `apps/api/prisma/schema.prisma`.
- Migrations : `apps/api/prisma/migrations/`.
- Client généré : `@prisma/client`.
- Données de développement : `apps/api/prisma/seed.ts` et identifiants stables dans `src/common/constants/seed-ids.ts` lorsqu'ils existent.
- Toute modification du schéma doit être accompagnée d'une migration, génération Prisma et tests ciblés ; l'application d'une migration en production est une opération contrôlée par le responsable du déploiement.

Ne jamais utiliser un seed pour modifier une base réelle sans vérifier sa portée et son caractère idempotent.

## Contrats et intégrations

- Contrat API publiable : génération OpenAPI via `pnpm export:openapi` à la racine (voir script racine), puis génération de types pour les clients selon les scripts disponibles.
- Paiements : `payments/providers/` et routes webhook. Un adaptateur présent ne signifie pas que l'environnement fournisseur, les secrets, remboursements ou reversements sont validés en production.
- Stockage : `media/` (R2) et services de documents. Séparer médias publics et documents privés selon les règles de chaque type.
- Notifications : les processors sous `notifications/` consomment les événements métier. Vérifier livraison, statut d'échec, retry, device token et préférence avant clôture.

## Tests

Tests unitaires et intégration du domaine : `apps/api/src/**/*.spec.ts`. Tests end-to-end : `apps/api/test/flows/`.

```powershell
cd apps\api
bun run test -- --runInBand
bun run test:e2e -- --runInBand
bun run build
```

Pour une correction, lancer d'abord le fichier ciblé via le runner Jest local, puis élargir aux tests du domaine et enfin au build. Les tests e2e peuvent nécessiter une base et une configuration d'environnement ; consulter leur setup avant exécution.
