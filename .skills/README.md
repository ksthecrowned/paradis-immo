---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: meta
audience: agents, humans
---

# `.skills/` — conventions de travail ciblées

Une skill donne les repères concrets d'un type de changement avant de toucher au code. Elle complète l'architecture et les specs ; le code courant reste la source de vérité.

## Routage

Lire seulement les skills utiles à la tâche, généralement 1 à 3.

| Tâche | Skills |
|---|---|
| Nouveau domaine ou endpoint API | `api-domain-pattern.md`, `testing.md` |
| Rôle, authentification, isolation | `auth-and-access.md`, `security.md`, `testing.md` |
| Schéma, migration, seed | `prisma-and-migrations.md`, `testing.md` |
| Paiement, ledger, remboursement, reversement | `money-flows.md`, `auth-and-access.md`, `testing.md` |
| Événements, notifications, tâches planifiées | `events-notifications.md`, `testing.md` |
| Site public ou portail web | `web-nextjs.md`, `api-domain-pattern.md` si l'API change |
| App mobile | `mobile-expo.md`, `api-domain-pattern.md` si l'API change |
| Release, configuration ou incident | `ops-release.md`, `security.md` |
| Changement de convention transverse | skills concernées + ADR selon `docs/adr/README.md` |

## Métadonnées et fraîcheur

Chaque skill porte `status`, `last-verified`, `owner`, `scope`, `audience`.

- `stable` : relu contre le code ; revalider au plus tard 90 jours après la date indiquée.
- `draft` : incomplet ou non encore vérifié ; ne pas le traiter comme contrat.
- `deprecated` : conservé pour historique, avec lien vers le remplaçant.

Mettre à jour la date uniquement après vérification réelle des chemins, commandes ou conventions concernés. Lorsqu'un changement invalide une skill, mettre à jour le fichier dans le même changement.

## Ajouter ou modifier une skill

1. Copier `template.md`.
2. Garder le périmètre ciblé et décrire des conventions vérifiables, pas une paraphrase générale du framework.
3. Ajouter le fichier à la table de routage ci-dessus et mettre à jour `CLAUDE.md` ou `AGENTS.md` si nécessaire.
4. Vérifier les liens internes et la cohérence des chemins/commandes avec les manifests.
5. Ne jamais y inclure de secret, donnée réelle ou identifiant sensible.

Depuis la racine, `pnpm docs:check` valide les champs du frontmatter, la fraîcheur des skills `stable` et leurs liens Markdown internes.

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
