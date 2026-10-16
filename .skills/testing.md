---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: testing
audience: agents, humans
---

# Stratégie de test — Paradis Immo

## Tests actuellement observés

- API : Jest; tests unitaires/HTTP co-localisés sous `apps/api/src/**/*.spec.ts`.
- Parcours API E2E : `apps/api/test/flows/`, config `apps/api/test/jest-e2e.json`.
- Web : ESLint via `apps/web/package.json`; tests/build spécifiques à vérifier dans les scripts.
- Mobile : tests de helpers co-localisés (quelques fichiers `*.test.ts`), mais aucun script test global déclaré dans le manifest mobile observé.

Ne pas affirmer que l'intégralité des trois apps a une suite automatisée uniforme.

## Choisir les tests

| Changement | Preuve minimale |
|---|---|
| Fonction pure | Test unitaire des cas normaux, frontières et entrée invalide |
| Contrôleur/DTO/guard | Test HTTP couvrant contrat, validation et autorisations |
| Transaction ou plusieurs domaines | Test intégration/E2E du workflow et de ses états persistés |
| RBAC / données privées | Cas autorisé et refusé (rôles, org, ID direct, liste, document) |
| Paiement | Montants, payeur, idempotence, callbacks doublés/désordonnés, échec et ledger ; jamais d'argent réel en test auto |
| Web/mobile UI | Test disponible des transformations/interactions et validation des états de chargement, vide, erreur et succès |
| Provider, stores ou opération réelle | Checklist manuelle avec environnement, version/build, résultat et responsable |

## Commandes vérifiées dans les manifests

À la racine :

```powershell
pnpm build
pnpm test
pnpm lint
```

Depuis `apps/api` :

```powershell
bun run test -- --runInBand
bun run test:e2e -- --runInBand
bun run build
```

Vérifier l'acceptation des options par les runners locaux. Les E2E peuvent dépendre d'une base de test et de variables d'environnement.

## Qualité d'un test

- Tester le comportement observable et les invariants, pas les détails privés d'implémentation.
- Pour les transitions métier, asserter l'état DB et les effets reliés, pas uniquement un code HTTP.
- Couvrir les cas concurrents lorsque deux demandes peuvent réserver une même ressource ou produire deux effets monétaires.
- Ne pas attendre par `setTimeout` arbitraire ; piloter le temps si le harness le permet.
- Fixer des données isolées et déterministes ; n'accéder à aucune donnée ou service de production.
- Garder les secrets/données réelles hors des fixtures et des sorties CI.

## Références

- [QA / release](../docs/qa/README.md)
- [Contribution](../CONTRIBUTING.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
