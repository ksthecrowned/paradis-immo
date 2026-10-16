---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: security
audience: agents, humans
---

# Sécurité applicative et données privées

## Modèle de menace minimal

Les données sensibles incluent identité/téléphone, KYC, documents fonciers, baux, communications et données financières. Les risques transverses incluent accès inter-agences, énumération, fuite de fichiers, abus OTP, rejouabilité webhook, et confusion entre API sandbox et production.

## Contrôles à examiner

- AuthN et rôle ne remplacent pas l'autorisation sur la ressource et le périmètre.
- Tester collection, détail par ID, recherche, export, notifications et téléchargement du fichier avec des identités de plusieurs organisations.
- Stocker les documents privés dans un bucket privé ; générer un accès court seulement après vérification serveur. Séparer média public des documents privés.
- Valider et borner les uploads (type réel, taille, propriété, scan/traitement selon capacité).
- Webhooks : authentifier l'émetteur, valider l'idempotence et rejeter les références/montants incohérents.
- Réduire les logs à l'information nécessaire ; expurger tokens, OTP, numéros complets, KYC, payloads et secrets.
- Prévenir l'énumération et l'abus par rate-limit adapté à la ressource, sans révéler existence ou identité.
- Vérifier CORS, headers, validation d'environnement et configuration selon les environnements.

## Avant un test de sécurité

Définir le périmètre et l'environnement autorisé. Ne pas lancer de fuzz, bruteforce, téléchargement massif, manipulation de paiement ou test d'accès sur production sans autorisation écrite. Utiliser des données et comptes fictifs.

## Références

- [Politique de sécurité](../SECURITY.md)
- [Spec sécurité](../docs/specs/01-compte-securite-conformite.md)
- [Isolation multi-agences](../docs/specs/16-preparation-lancement-et-exigences-transverses.md)
- [Auth et accès](auth-and-access.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
