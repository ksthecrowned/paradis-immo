---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: data
audience: agents, humans
---

# Prisma et migrations

## Où regarder

- Schéma : `apps/api/prisma/schema.prisma`.
- Migrations : `apps/api/prisma/migrations/`.
- Client : `apps/api/src/prisma/`.
- Seed : `apps/api/prisma/seed.ts`; IDs seed stables éventuellement sous `apps/api/src/common/constants/seed-ids.ts`.
- Commandes : `apps/api/package.json`, scripts racine `package.json`.

## Workflow schéma

1. Lire les modèles et migrations voisines ; considérer les données existantes et la compatibilité de déploiement.
2. Modifier le schéma et créer une migration selon la procédure de l'environnement.
3. Générer le client avec `bun run prisma:generate` depuis `apps/api` (le build appelle aussi `prisma generate`).
4. Tester les contraintes, défauts, suppressions, relations et données existantes.
5. Documenter le déploiement/rollback si migration risquée.

`bun run prisma:migrate` exécute `prisma migrate dev`; ne pas l'utiliser pour appliquer une migration de production. Vérifier la procédure de déploiement effective avant tout changement de base distante.

## Invariants de données

- Une transaction DB ne couvre pas automatiquement un fournisseur externe ; concevoir idempotence, états intermédiaires et reprise.
- Les montants utilisent les types monétaires du schéma, et les dates nécessitent une convention métier/fuseau explicite.
- Utiliser contraintes uniques et index au niveau DB pour les invariants qui doivent résister à la concurrence.
- Les seeds doivent rester isolés aux bases locales/tests dédiées.

## À éviter

- Modifier la base à la main sans migration versionnée.
- Supprimer/renommer une colonne avant migration compatible des lecteurs et writers déployés.
- Lancer seed, migration ou script de stockage en production sans approbation, sauvegarde et procédure documentées.

## Références

- [Architecture API](../docs/architecture/api.md)
- [Runbook](../docs/ops/runbook.md)
- [Spec lancement](../docs/specs/16-preparation-lancement-et-exigences-transverses.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
