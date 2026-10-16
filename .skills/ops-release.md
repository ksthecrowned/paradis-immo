---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: operations
audience: agents, humans
---

# Exploitation et release

## Où regarder

- Développement local : `docker-compose.yml`, `.env.example`, `README.md`.
- API : `render.yaml`, `apps/api/package.json`.
- Web : config Vercel si présente, `apps/web/package.json`.
- Mobile : `apps/mobile/app.json`, `eas.json` si présents, et scripts Expo.
- Runbook : [`docs/ops/runbook.md`](../docs/ops/runbook.md).

## Principes de release

- Identifier commit, version, environnement, migrations et secrets par environnement.
- Garder développement, test, préproduction et production séparés pour DB, bucket, OTP, push et paiements.
- Planifier les migrations compatibles avant déploiement et une stratégie de retour/mitigation.
- Ne pas traiter `GET /health` comme une preuve de disponibilité complète de DB, workers, providers ou storage.
- Smoke-test uniquement des parcours autorisés et à faible risque ; les paiements réels exigent une approbation et les plafonds documentés.
- Vérifier logs et alertes expurgés, version déployée, intégrations et état de la base.
- Tout changement d'état externe doit être reprenable et idempotent.

## Opérations à risque

Migration DB, migration de fichiers, seed, effacement/anonymisation, rotation de secret, payout et paiement réel exigent un environnement confirmé, autorisation explicite, sauvegarde ou procédure compensatoire, et une personne responsable.

## Références

- [Runbook](../docs/ops/runbook.md)
- [Porte de lancement](../docs/specs/16-preparation-lancement-et-exigences-transverses.md)
- [Security](security.md)
- [Prisma](prisma-and-migrations.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
