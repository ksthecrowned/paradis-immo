# Contribuer à Paradis Immo

## Avant de modifier

1. Lire le [README racine](README.md), [AGENTS.md](AGENTS.md), puis [la documentation](docs/README.md).
2. Lire 1 à 3 [skills pertinentes](.skills/README.md) et la spec du domaine concerné.
3. Vérifier le code local et l'état du worktree : ne pas écraser les modifications d'autres tâches.
4. Déterminer les surfaces impactées : API, site public, portail web, mobile, schéma et opérations.
5. Créer ou actualiser un ADR si la tâche change une convention ou décision transverse.

## Règles de changement

- L'API est l'autorité des règles métier, permissions et états.
- Toute donnée privée ou action doit être autorisée côté serveur, par ressource et par périmètre d'organisation/mandat.
- Ne jamais considérer un identifiant reçu du client comme une autorisation.
- Toute mutation financière doit préserver les invariants, l'idempotence et l'auditabilité.
- Une modification de schéma Prisma implique une migration et la régénération du client.
- Garder les clients web/mobile alignés sur les contrats OpenAPI et ne jamais exposer de secret serveur.
- Distinguer les états chargement, vide, erreur et succès ; ne pas masquer les erreurs derrière des valeurs par défaut.
- Mettre à jour la doc produit ou architecture directement liée au changement.

## Tests et validations

Depuis la racine, les scripts existants incluent :

```powershell
pnpm build
pnpm test
pnpm export:openapi
pnpm generate:types
pnpm lint
pnpm docs:check
```

Les scripts délèguent aux applications et nécessitent leurs dépendances installées. Utiliser le test le plus ciblé qui couvre réellement la modification, puis élargir si nécessaire. Pour les tests API, les commandes exécutées dans `apps/api` sont définies par son `package.json`. Consulter le script avant de lancer un test d'intégration susceptible de dépendre d'une base.

Avant livraison :

- tests ciblés et build applicables réussis ;
- migration examinée si le schéma change ;
- accès positif et négatif testés pour les données protégées ;
- contrats OpenAPI/types vérifiés pour un changement API ;
- `pnpm docs:check` réussi si une skill change ;
- docs et critères d'acceptation mis à jour ;
- aucun secret, token, numéro ou document réel dans le diff ou les fixtures.

## Résumé de changement recommandé

```text
Domaines :
Surfaces touchées : API / web public / portail / mobile / DB / ops
Contrat API ou modèle changé :
Accès/risques :
Tests exécutés :
Docs mises à jour :
Limites ou validations manuelles restantes :
```

## Documentation

Les exigences sont dans `docs/specs/`. Les faits d'architecture sont décrits dans `docs/architecture/` et `docs/ARCHITECTURE.md`. Les opérations sont décrites dans `docs/ops/`. Quand une modification corrige ou invalide un constat d'audit, mettre à jour le delta concerné et dater la nouvelle vérification. « Présent localement » ne signifie pas « prêt en production ».
