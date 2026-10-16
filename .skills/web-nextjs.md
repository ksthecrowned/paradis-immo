---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: web
audience: agents, humans
---

# Site et portail Next.js

## Où regarder

- Routes : `apps/web/app/`; `owner/`, `agent/`, `admin/` sont les espaces de gestion.
- Auth/session : `apps/web/auth.ts`, `middleware.ts`.
- Appels API : `apps/web/lib/api.ts`; clients sous `apps/web/lib/{admin,agent,owner,...}`.
- Composants : `apps/web/components/`.
- Exigences locales : `apps/web/AGENTS.md` et `apps/web/CLAUDE.md`.

## Règles

- **Avant tout changement de code Next.js, lire le guide pertinent dans `apps/web/node_modules/next/dist/docs/`.** Cette version comporte des changements incompatibles ; ne pas transposer une convention mémorisée.
- Respecter les règles de l'App Router et l'emplacement existant des routes/composants.
- Les pages/middleware améliorent l'expérience, mais l'API doit refaire l'autorisation.
- Passer par `apiFetch` ou le client de domaine correspondant pour préserver session, retry 401, erreurs et contrats pagination.
- Présenter les états chargement, vide, erreur et réessai séparément ; une panne API n'est jamais un zéro ou une liste vide.
- Garder le site public distinct du portail privé de gestion.
- Ne jamais inclure un secret backend dans une variable `NEXT_PUBLIC_*`.

## Validation

Scripts déclarés dans `apps/web/package.json` : `bun run lint`, `bun run build`. Depuis la racine, `pnpm lint` délègue au lint web et `pnpm build` construit API puis web.

## Références

- [Instructions web](../apps/web/AGENTS.md)
- [Architecture client](../docs/architecture/clients.md)
- [Contribution](../CONTRIBUTING.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
