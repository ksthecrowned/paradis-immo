---
status: stable
last-verified: 2026-10-16
owner: paradis-immo-maintainers
scope: mobile
audience: agents, humans
---

# App client Expo

## Où regarder

- Routes et layouts Expo Router : `apps/mobile/app/`.
- Session/API : `apps/mobile/lib/auth.ts`, `lib/api.ts`, `lib/config.ts`.
- Services par domaine : `apps/mobile/lib/`.
- Contexte/composants : `context/`, `components/`, `hooks/`.
- Dépendances et scripts : `apps/mobile/package.json`.
- Périmètre produit : [spec 14](../docs/specs/14-mobile-transverse.md).

## Règles

- L'app mobile est pour les clients finaux (chercheur, locataire, voyageur, acheteur), pas une console Owner/Agent.
- Utiliser les clients API/types/helpers déjà présents dans `lib/` avant d'ajouter un appel ponctuel.
- API décide des statuts, permissions et montants ; ne pas afficher un succès anticipé sur une mutation.
- `auth.ts` stocke les tokens dans Expo SecureStore et les données de profil non secrètes dans AsyncStorage. Ne jamais déplacer les tokens en stockage non chiffré.
- Préserver l'unicité du refresh concurrent et la purge de session au logout/expiration.
- Concevoir les états offline, permission système, erreur réseau et reprise explicitement ; une opération financière hors-ligne ne doit pas être considérée comme réussie.
- Pour deep links, vérifier le routage déclaré et imposer l'authentification/autorisation serveur sur les données privées.
- Respecter les conventions de navigation et de configuration propres à la version Expo installée.

## Validation

Scripts déclarés : `bun run start`, `bun run android`, `bun run ios`, `bun run web`, `bun run prebuild`. Il n'existe pas de script `test` standard déclaré dans `apps/mobile/package.json`; vérifier les tests ciblés et config présents avant d'affirmer une validation complète.

## Références

- [Architecture client](../docs/architecture/clients.md)
- [Spec mobile](../docs/specs/14-mobile-transverse.md)
- [Auth et accès](auth-and-access.md)

---

> **Mainteneur** : `paradis-immo-maintainers` — revalider au moins tous les 90 jours.
> **Source de vérité** : le code et les manifests. En cas de divergence, corriger la skill.
