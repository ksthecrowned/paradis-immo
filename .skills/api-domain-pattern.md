---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: api
audience: agents, humans
---

# Domaines API NestJS — Paradis Immo

## Où regarder

- `apps/api/src/app.module.ts` — modules branchés à l'application.
- `apps/api/src/<domain>/` — contrôleurs, services, DTOs, module et tests du domaine.
- `apps/api/src/main.ts` — préfixe HTTP, validation, filtre d'erreur, CORS et Swagger.
- `apps/api/prisma/schema.prisma` — relations et statuts persistés.
- `docs/architecture/api.md` — carte de navigation.

## Règles de changement

- Garder les contrôleurs centrés sur le contrat HTTP et la délégation ; placer les règles du domaine dans le service propriétaire.
- Valider l'entrée dans un DTO. La `ValidationPipe` globale rejette les champs inconnus : ne pas compter sur une propriété client non déclarée.
- Les endpoints sont sous `/api/v1`, sauf `GET /health`; Swagger est monté sur `/api/v1/docs`.
- Vérifier le format de réponse réellement produit par le filtre et le contrôleur. Les listes peuvent avoir un contrat de pagination distinct ; ne pas imposer un enveloppe ou une pagination inventée.
- Réutiliser les règles d'accès et services de domaine existants plutôt que dupliquer les requêtes Prisma.
- Une mutation métier multi-étape doit examiner transaction, unicité, concurrence et événements émis.
- Après ajout d'un module, l'enregistrer dans `AppModule` et ajouter ses tests près du domaine.

## À éviter

- Introduire logique métier, appels externes ou transactions complexes dans un contrôleur.
- Retourner des entités Prisma brutes qui exposent champs internes.
- Considérer que Swagger, la validation DTO ou le middleware web remplace un contrôle d'autorisation.
- Ajouter un événement en supposant qu'un listener ou retry existe.

## Validation

Depuis `apps/api`, les scripts déclarés incluent `bun run build`, `bun run test` et `bun run test:e2e`. L'e2e utilise `test/jest-e2e.json` et peut exiger une base dédiée. Choisir le test du domaine puis le build.

## Références

- [Architecture API](../docs/architecture/api.md)
- [Contribution](../CONTRIBUTING.md)
- [Tests](testing.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
