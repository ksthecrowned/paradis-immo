# Politique de sécurité — Paradis Immo

## Périmètre

Cette politique concerne l'API, le site web, le portail de gestion, l'app mobile, les intégrations, les données et les infrastructures exploitées pour Paradis Immo. Le dépôt et les environnements de production ne doivent pas être considérés comme accessibles à tous les contributeurs.

## Signaler un problème

Ne publiez pas de détails exploitables, secrets, données personnelles ou preuve contenant des données réelles dans une issue publique.

1. Utiliser le signalement privé de vulnérabilité GitHub du dépôt, s'il est activé.
2. Sinon, prévenir directement les mainteneurs via un canal privé approuvé par l'équipe.
3. N'effectuer aucun test sur des comptes, agences, paiements, fichiers ou systèmes de production sans autorisation écrite et périmètre défini.

Inclure si possible : composant, impact, version/commit, étapes minimales de reproduction dans un environnement autorisé, et mitigation éventuelle. Ne joindre aucun secret ni donnée client.

## Priorisation et traitement

Les mainteneurs évaluent la confidentialité, l'intégrité, la disponibilité, le risque financier et le nombre de tenants concernés. Un correctif doit ajouter une régression testée et, si nécessaire, révoquer/rotater les secrets ou sessions affectés. Ne pas promettre de délai fixe avant qu'un responsable et un processus de triage soient établis.

## Principes obligatoires

- Secrets en variables d'environnement ou gestionnaire de secrets ; jamais dans Git, logs, screenshots ou documentation.
- Données immobilières, identité, documents KYC, baux, paiements et messages doivent suivre leurs politiques d'accès spécifiques.
- Appliquer l'autorisation côté serveur aux opérations par ID, liste, recherche, fichier et export.
- Pour les webhooks, valider la preuve d'origine, la cible, les montants et l'idempotence ; éviter de journaliser des payloads sensibles sans redaction.
- Ne pas utiliser de données réelles dans les fixtures, seeds de développement, tickets ou tests automatisés.
- Les systèmes de production, fournisseurs de paiement et buckets de stockage ne sont jamais des cibles de test par défaut.

## Préparation de production

La présence d'un guard, d'une intégration ou d'un test unitaire isolé ne suffit pas à prouver la sécurité de la plateforme. Suivre les critères d'isolation et de stockage privé de [la spec 16](docs/specs/16-preparation-lancement-et-exigences-transverses.md) et les checklists de lancement approuvées.
