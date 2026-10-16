# Architecture des clients web et mobile

## Frontières fonctionnelles

| Surface | Utilisateurs | Rôle |
|---|---|---|
| Site public Next.js | Public | Découverte et consultation des annonces, pages marketing |
| Portail web Next.js | Owner, agent, administrateur d'agence et administrateur plateforme | Gestion immobilière et back-office |
| App Expo | Chercheurs, locataires, voyageurs et acheteurs | Parcours clients authentifiés et suivi des opérations |

Les règles de rôle définies côté serveur sont prioritaires. Le web ne doit pas exposer un espace client final alternatif ; l'app mobile ne doit pas devenir une console de gestion des propriétaires ou agents.

## Web (`apps/web`)

### Organisation

- `app/` utilise l'App Router Next.js.
- `app/owner/`, `app/agent/`, `app/admin/` regroupent les routes de gestion.
- `components/` contient les composants de page partagés par domaine.
- `lib/api.ts` centralise les appels backend, l'attachement du bearer token, le retry après 401 et le traitement de l'enveloppe.
- `auth.ts` configure NextAuth et la session de gestion.
- `middleware.ts` applique les gardes de routes web ; les autorisations de données doivent également être imposées par l'API.

### Zones d'interface observées

| Route | Fonction |
|---|---|
| `/` | Site vitrine public |
| `/owner/*` | Portefeuille et opérations du propriétaire |
| `/agent/*` | Opérations d'agence et d'agent |
| `/admin/*` | Administration plateforme |
| `/login`, `/register`, `/onboarding/*` | Entrée et rattachement au portail de gestion |

La liste des routes évolue avec le code ; pour l'inventaire exact, consulter `apps/web/app/`. Les labels visibles sont en français alors que plusieurs routes sont en anglais.

### Appels API et erreurs

Utiliser `apiFetch`/`apiFetchPaginated` dans `lib/api.ts` et les clients spécialisés existants (`lib/owner`, `lib/agent`, `lib/admin`, etc.). Conserver les erreurs distinguées de l'état vide ; ne pas convertir un échec réseau en liste vide ou compteur zéro. Les contrats de pagination peuvent varier : vérifier le DTO serveur et le helper du client concerné.

## Mobile (`apps/mobile`)

### Organisation

- `app/` utilise Expo Router ; `(auth)` porte les écrans d'accès et `(tabs)` les surfaces principales.
- Les routes profondes de biens, visites, séjours, baux, achats, paiements et profil sont en `app/`.
- `lib/` regroupe les clients API et les transformations par domaine ; éviter de créer un appel HTTP ponctuel si un client de domaine existe.
- `components/`, `context/`, `hooks/` partagent l'interface et l'état transversal.

### Session et données locales

- Authentification principalement par OTP via l'API.
- `lib/auth.ts` stocke actuellement les tokens dans Expo SecureStore et le profil non secret dans AsyncStorage.
- Les appels passent par `lib/api.ts`, qui ajoute l'access token et tente un refresh sur 401.
- Les fonctions de déconnexion/refresh sont sensibles à la rotation de tokens ; préserver l'unicité du refresh et les tests de concurrence.
- Toute donnée mise en cache doit avoir un propriétaire, une durée de vie, un comportement logout et une règle de purge.

### Navigation et liens

Les routes sont définies dans `app/` et les URL doivent être vérifiées dans la configuration Expo Router avant de les inclure dans notifications ou emails. Les liens privés exigent une session et une autorisation serveur ; un deep link n'est jamais une preuve d'accès.

## Contrat client/API

- L'API est la source de vérité des statuts, droits, montants et transitions.
- Ne pas fabriquer d'état de succès côté client avant confirmation serveur.
- Pour les mutations financières, transmettre l'identifiant d'idempotence si l'endpoint le prévoit et interroger l'état métier après le retour du fournisseur.
- Générer ou maintenir les types clients selon le script racine, puis confirmer leur cohérence avec OpenAPI.
- Lorsque l'API change, mettre à jour les consommateurs touchés et tester erreurs, chargement, vide, reprise et authentification expirée.

## Ressources

- [Spec mobile client](../specs/14-mobile-transverse.md)
- [Spec recherche et annonces](../specs/13-recherche-annonces.md)
- [Index des interfaces de gestion](../specs/03-gerance-mandats-comptabilite.md) et [admin](../specs/12-admin-back-office.md)
