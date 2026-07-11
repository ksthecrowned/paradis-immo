# Paradis Immo

Plateforme immobilière hybride (location courte / longue, vente) pour le Congo.

Monorepo **pnpm** :

| App           | Stack                             | Port   |
| ------------- | --------------------------------- | ------ |
| `apps/api`    | NestJS, Prisma, PostgreSQL        | `3001` |
| `apps/web`    | Next.js, Tailwind, Preline        | `3000` |
| `apps/mobile` | Expo (marketplace + OTP)          | Expo Go |

---

## Prérequis

- Node.js ≥ 18
- [pnpm](https://pnpm.io)
- PostgreSQL

---

## Installation

```bash
pnpm install
cp .env.example .env
```

Renseigne au minimum dans `.env` (racine, lu par l’API) :

```env
DATABASE_URL=postgresql://postgres:postpass@localhost:5432/paradis_immo
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
```

Laisse `INFOBIP_*` vides en local : le code OTP est alors **affiché dans les logs de l’API**.

Côté web (`apps/web/.env`) :

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api/v1
AUTH_SECRET=  # openssl rand -base64 32
AUTH_URL=http://localhost:3000

# Optionnel — liens App Store / Play sur la landing
NEXT_PUBLIC_APP_STORE_URL=
NEXT_PUBLIC_PLAY_STORE_URL=
```

Optionnel — upload photos propriétaire (Cloudflare R2) dans `.env` racine ou `apps/api/.env` :

```env
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=https://cdn.example.com
```

Sans R2, la création de bien et la galerie fonctionnent ; le **presign upload** renvoie une erreur explicite. Le seed inclut une photo Unsplash sur le bien démo (pas besoin de R2).

L’auth web utilise **NextAuth (Auth.js v5)** : OTP Nest → session JWT cookie avec `accessToken` + `refreshToken`. Le refresh est géré dans le callback JWT (avant expiration de l’access token, 14 min). Les routes `/owner`, `/agent`, `/admin` sont protégées par `middleware.ts` (auth + garde admin).

### Base de données

```bash
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed
```

Le seed crée :

- le pays Congo (CG), villes Brazzaville / Pointe-Noire
- l’organisation plateforme **Paradis Immo** (`org_paradis_immo`)
- les **comptes de test** (voir ci-dessous)
- **3 biens démo actifs** : location longue, vente, courte durée
- **1 photo** sur le bien location longue (URL publique, sans R2)
- une **demande de vente** (NEW) sur le bien SALE
- un paiement cash en attente de validation

---

## Lancer en développement

Deux terminaux (ou `pnpm dev` à la racine pour tout lancer) :

```bash
# API
pnpm --filter api start:dev
# ou depuis apps/api : bun run start:dev

# Web
pnpm --filter web dev
# ou depuis apps/web : bun run dev
```

| Service       | URL                                 |
| ------------- | ----------------------------------- |
| Web (landing) | http://localhost:3000               |
| Login         | http://localhost:3000/login         |
| API           | http://localhost:3001/api/v1        |
| Health        | http://localhost:3001/api/v1/health |
| Swagger       | http://localhost:3001/api/docs      |

La page d’accueil (`/`) est la **landing Estatery** (kit Figma), brandée Paradis Immo. Login / Sign up mènent à `/login`.

---

## Connexion locale (OTP)

L’auth se fait par **numéro WhatsApp + code OTP** (pas de mot de passe).

1. Ouvre http://localhost:3000/login
2. En **dev**, un encadré **Comptes de test** liste les numéros seedés — clique pour préremplir
3. Clique **Recevoir le code**
4. Sans Infobip, le code à **6 chiffres** apparaît dans le **terminal de l’API** :

   ```
   [dev] WhatsApp OTP for +242060000001: 482917 (Infobip not configured)
   ```

5. Saisis le code et connecte-toi

La session NextAuth est en cookie httpOnly (JWT chiffré). L’API Nest reçoit le Bearer `accessToken` via `apiFetch`.

Après login, la redirection dépend du compte :

| Rôle             | Téléphone       | Dashboard          |
| ---------------- | --------------- | ------------------ |
| **Admin**        | `+242060000001` | `/admin/dashboard` |
| **Agent**        | `+242060000002` | `/agent/dashboard` |
| **Propriétaire** | `+242060000003` | `/owner/dashboard` |
| **Locataire**    | `+242060000004` | `/owner/dashboard` |

Ces comptes sont définis dans `apps/api/prisma/seed.ts` et rappelés côté web dans `apps/web/lib/dev-test-accounts.ts`.

### Données de démo (seed)

IDs stables UUID dans `apps/api/src/common/constants/seed-ids.ts`. Photos R2 : `bun run seed:upload-images` puis `bun run prisma:seed`.

| ID | Mode | Titre |
|----|------|-------|
| `823b9231-…6496d` (`SEED_IDS.propRentLong`) | RENT_LONG | Appartement Centre-ville (visites + photos R2) |
| `29faa8b3-…b83ec` (`SEED_IDS.propSale`) | SALE | Villa Whispering Pines |
| `b5afc862-…04dd8c` (`SEED_IDS.propShort`) | RENT_SHORT | Maison Tié-Tié |
| `a50c3b1b-…de0c3` (`SEED_IDS.propLand`) | SALE / LAND | Terrain Mongo-Poukou |

- Paiement cash **75 000 XAF** en `PENDING_VALIDATION` → visible pour l’agent sur `/agent/payments/validation`

### Premier login hors comptes seed

Un numéro inconnu crée un utilisateur avec le rôle global `TENANT` uniquement. Pour lui donner d’autres droits, modifier la base puis **se reconnecter** (les rôles sont dans le JWT).

Exemple admin :

```sql
INSERT INTO "UserRole" (id, "userId", role)
VALUES (gen_random_uuid(), 'USER_ID', 'PLATFORM_ADMIN');
```

Exemple agent (membre Paradis Immo — UUID `SEED_IDS.orgParadisImmo`) :

```sql
INSERT INTO "OrganizationMember" (id, "organizationId", "userId", role)
VALUES (gen_random_uuid(), '7beb9e56-cd2b-4235-befe-e0aa5f2b3b4b', 'USER_ID', 'AGENT');
```

---

## Routes dashboard (web)

Chemins en anglais, labels UI en français.

### Admin (`PLATFORM_ADMIN`)

| Page            | Route               |
| --------------- | ------------------- |
| Tableau de bord | `/admin/dashboard`  |
| Utilisateurs    | `/admin/users`      |
| Modération      | `/admin/moderation` |
| Configuration   | `/admin/config`     |

### Agent (membre org `AGENT`)

| Page                 | Route                        |
| -------------------- | ---------------------------- |
| Tableau de bord      | `/agent/dashboard`           |
| Portefeuille         | `/agent/portfolio`           |
| Réservations         | `/agent/bookings`            |
| Visites              | `/agent/visits`              |
| Baux                 | `/agent/leases`              |
| Demandes vente       | `/agent/sales`               |
| Validation paiements | `/agent/payments/validation` |
| Maintenance          | `/agent/maintenance`         |

### Propriétaire

| Page            | Route                                      |
| --------------- | ------------------------------------------ |
| Tableau de bord | `/owner/dashboard`                         |
| Biens           | `/owner/properties`                        |
| Ajouter un bien | `/owner/properties/add`                    |
| Créneaux visite | `/owner/properties/[id]/visit-slots`       |
| Réservations    | `/owner/bookings`                          |
| Visites         | `/owner/visits`                            |
| Baux            | `/owner/leases`                            |
| Paiements       | `/owner/payments`                          |
| Maintenance     | `/owner/maintenance`                       |
| Mandat          | `/owner/mandate`                           |

---

## Checklist smoke (MVP web)

Parcours manuels à valider après `prisma:seed` + `pnpm dev`. Détail : `docs/superpowers/specs/2026-07-04-web-mvp-product-design.md` § Test plan.

| # | Flow | Compte | Étapes |
|---|------|--------|--------|
| 1 | Créer un bien RENT_LONG + 2 photos | Propriétaire | `/owner/properties/add` → upload (R2 requis) → voir dans la liste |
| 2 | Créer biens SALE et RENT_SHORT | Propriétaire | Modes vente et courte durée sur le formulaire |
| 3 | Créneaux de visite | Propriétaire | Bien `prop_test_demo` → Créneaux → ajouter un modèle hebdo |
| 4 | Valider paiement cash | Agent | `/agent/payments/validation` → valider le paiement seed 75 000 XAF |
| 5 | Créer un bail | Agent | `/agent/leases` → `prop_test_demo` + `user_test_tenant` |
| 6 | Demande de vente | Agent | `/agent/sales` → avancer le statut (inquiry seed sur `prop_test_sale`) |
| 7 | Modération admin | Admin | `/admin/moderation` → mettre en pause un bien → landing ne l’affiche plus |
| 8 | Garde auth admin | — | Déconnecté ou propriétaire → `/admin/users` redirige vers login ou owner |
| 9 | Landing live | — | `/` affiche les biens ACTIVE ; clic → modal téléchargement app |

**Raccourcis seed :** les flows 3, 4, 7 et 9 sont testables immédiatement sans créer de données supplémentaires.

```bash
# Vérification automatisée (Task 12)
pnpm --filter api test
pnpm --filter web build
```

---

## App mobile (Expo)

Design : `resources/figma-design.md` (onboarding Figma + kit Estatery). Logo : `resources/logo-paradis-immo.png`.

### Setup

```bash
# 1. Copier le logo (depuis Downloads ou resources/)
pnpm --filter mobile setup:logo

# 2. Dépendances + config
cd apps/mobile
cp .env.example .env
pnpm install
```

`EXPO_PUBLIC_API_URL` — sur émulateur Android : `http://10.0.2.2:3001/api/v1`.

### Lancer

```bash
pnpm --filter mobile start
```

Parcours mobile : onboarding → OTP → marketplace (auth requise) → visites / réservations / paiements → favoris sync + push FCM.

- Tabs, activité, visites, réservations et paiements : **connexion OTP obligatoire**
- Fiche bien : consultation libre ; favoris / CTA → redirect login avec retour automatique
- Déconnexion : onglet Activité

## Tests E2E (flows critiques)

```bash
pnpm --filter api test:e2e -- test/flows
```

- `mandate-lease` — bail sous mandat bloqué jusqu’à approbation `LEASE_SIGN`
- `paid-visit` — visite payante : réserver → payer → confirmer → créneau `BOOKED`
- `booking` — rejet des réservations courtes durée qui se chevauchent

Compte test locataire : `+242060000004` (OTP dans les logs API).

---

## Scripts utiles

```bash
# Tout le monorepo
pnpm build
pnpm test                 # tests API
pnpm export:openapi       # régénère apps/api/openapi.json
pnpm generate:types       # types OpenAPI → apps/web & apps/mobile

# API uniquement
pnpm --filter api prisma:seed
pnpm --filter api test
pnpm --filter api test:e2e
```

---

## Structure

```
apps/
  api/          NestJS + Prisma
  web/          Next.js dashboard (owner / agent / admin)
  mobile/       Expo (marketplace)
docs/
  superpowers/  plans & specs MVP
```

Plans détaillés :

- MVP parent : `docs/superpowers/plans/2026-06-27-paradis-immo-mvp.md`
- Routes dashboard : `docs/superpowers/plans/2026-06-29-paradis-immo-dashboard-ui-routes.md`
- **Spec MVP web produit** : `docs/superpowers/specs/2026-07-04-web-mvp-product-design.md`
- **Plan d’implémentation MVP web** : `docs/superpowers/plans/2026-07-04-web-mvp-product-plan.md` (tâches 1–12)
