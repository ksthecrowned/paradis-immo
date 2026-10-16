# QA, validation et release

Cette page définit comment convertir les exigences produit en preuves de fonctionnement. Elle ne prétend pas que les scénarios ont déjà été exécutés.

## Sources des scénarios

1. Partir des critères d'acceptation dans `docs/specs/`.
2. Relier chaque scénario à un domaine et aux tests présents sous `apps/api/src/**/*.spec.ts`, `apps/api/test/flows/`, ou aux tests clients.
3. Ajouter les scénarios manuels uniquement là où l'émulateur, le fournisseur, les stores ou l'opération ne peuvent pas être prouvés localement.
4. Garder une référence de preuve expurgée : commit/build, environnement, date, résultat et responsable.

## Niveaux de validation

| Niveau | But | Preuve typique |
|---|---|---|
| Unitaire | Règle métier isolée et transitions | Test de service ou fonction pure |
| HTTP / intégration | Contrat, validation DTO, guard, accès et persistance | Test HTTP/API avec base de test |
| Parcours E2E | Parcours multi-domaines critique | Scénarios dans `apps/api/test/flows/` et tests clients |
| Manuel contrôlé | Fournisseur, device, UX réelle, stores ou exploitation | Checklist avec build, environnement et responsable |
| Production | Vérifier disponibilité réelle après release | Smoke autorisé, alertes et observabilité ; jamais une preuve de sandbox |

## Périmètre minimal avant d'ouvrir un pilote réel

- Tests positifs et négatifs d'isolation entre organisations, rôles, biens et fichiers privés.
- Authentification, expiration, refresh et révocation sur web et mobile.
- Au moins un parcours métier complet de bout en bout par fonctionnalité activée.
- Paiements et reversements désactivés tant que fournisseurs, callbacks, rapprochement, remboursements et procédures opératoires ne sont pas validés.
- Sauvegarde/restauration vérifiée et procédures d'incident connues des responsables.
- Fonctionnalités non prêtes masquées ou explicitement indisponibles ; aucun faux succès.

Les gates détaillés et responsabilités sont définis dans [spec 16](../specs/16-preparation-lancement-et-exigences-transverses.md).

## Journal de campagne

Pour chaque exécution, consigner :

```text
ID scénario :
Domaine / rôle :
Commit ou build :
Environnement :
Préconditions (données fictives) :
Étapes :
Résultat attendu / observé :
OK / KO / Bloqué :
Référence bug (sans donnée sensible) :
Testeur / date :
```

## Dérogations

Un défaut qui affecte l'autorisation, la confidentialité, les montants, une transition financière, la perte de données ou une opération critique ne peut pas être accepté par simple note informelle. Toute dérogation doit avoir un responsable, un périmètre, une échéance, une mitigation et une approbation explicite. Les risques bloquants de sécurité ou de fonds ne sont pas des dérogations de pilote.
