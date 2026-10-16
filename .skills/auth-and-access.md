---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: auth
audience: agents, humans
---

# Authentification et autorisations

## Où regarder

- API : `apps/api/src/auth/`, guards/decorators dans `common/`, `mandates/agency-access.service.ts`.
- Web : `apps/web/auth.ts`, `apps/web/middleware.ts`, `apps/web/lib/api.ts`.
- Mobile : `apps/mobile/lib/auth.ts`, `apps/mobile/lib/api.ts`.
- Données : `User`, `UserRole`, `OrganizationMember`, `RefreshToken` dans `apps/api/prisma/schema.prisma`.
- Exigences : specs 01–02 et 16.1.

## Principes

- L'API décide de l'identité, du rôle, de l'appartenance active, du mandat et de l'accès à la ressource ; une route UI protégée n'est pas une permission API.
- Toujours contrôler l'accès sur les détails par ID et les collections, filtres, documents, exports et actions métier.
- Un `organizationId`, `propertyId`, `userId` ou rôle transmis par le client ne prouve jamais l'accès.
- Appliquer la règle de périmètre appropriée à chaque domaine. Pour les ressources immobilières gérées, inspecter le service d'accès partagé et les exceptions du domaine.
- Distinguer le rôle plateforme `PLATFORM_ADMIN`, le membre d'agence `ADMIN` et `AGENT`, ainsi que les rôles clients. Ne pas inférer l'un depuis l'autre.
- Le portail web utilise NextAuth et une session JWT ; le mobile utilise OTP et SecureStore. Les deux clients transmettent le bearer token à l'API.
- Toute modification de refresh/rotation doit considérer les requêtes concurrentes et les tokens à usage unique.

## Tests obligatoires pour une règle d'accès

Ajouter les cas autorisé et refusé : bon rôle et bon périmètre, rôle incorrect, organisation distincte, membre inactif/non assigné, identifiant direct, liste filtrée et fichier privé si applicable. Refuser sans exposer les données hors périmètre.

## À éviter

- Se fier à la visibilité/présence d'un bouton, aux claims non revalidés ou aux paramètres de route seuls.
- Élargir la requête puis filtrer uniquement dans le client.
- Retourner des URL publiques pour un document privé.
- Journaliser un bearer, refresh token, OTP, numéro complet ou payload KYC.

## Références

- [Spec compte et sécurité](../docs/specs/01-compte-securite-conformite.md)
- [Spec organisations](../docs/specs/02-organisations-equipes.md)
- [Gate isolation](../docs/specs/16-preparation-lancement-et-exigences-transverses.md)
- [Security](security.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
