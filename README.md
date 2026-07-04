# Paradis Immo

Plateforme immobilière hybride (location courte / longue, vente) pour le Congo.

Monorepo **pnpm** :

| App           | Stack                             | Port   |
| ------------- | --------------------------------- | ------ |
| `apps/api`    | NestJS, Prisma, PostgreSQL, Redis | `3001` |
| `apps/web`    | Next.js, Tailwind, Preline        | `3000` |
| `apps/mobile` | Expo (à venir)                    | —      |

---

## Prérequis

- Node.js ≥ 18
- [pnpm](https://pnpm.io)
- PostgreSQL
- Redis (stockage OTP)

---

## Installation

```bash
pnpm install
cp .env.example .env
```

Renseigne au minimum dans `.env` (racine, lu par l’API) :

```env
DATABASE_URL=postgresql://postgres:postpass@localhost:5432/paradis_immo
REDIS_URL=redis://localhost:6379
JWT_SECRET=change-me
JWT_REFRESH_SECRET=change-me-too
```

Laisse `INFOBIP_*` vides en local : le code OTP est alors **affiché dans les logs de l’API**.

Côté web (`apps/web/.env`) :

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:3001/api/v1
AUTH_SECRET=  # openssl rand -base64 32
AUTH_URL=http://localhost:3000
```

L’auth web utilise **NextAuth (Auth.js v5)** : OTP Nest → session JWT cookie avec `accessToken` + `refreshToken`. Le refresh est géré dans le callback JWT (avant expiration de l’access token, 14 min). Les routes `/owner`, `/agent`, `/admin` sont protégées par `proxy.ts` (convention Next.js 16).

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
- un bien démo actif
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

- Bien actif « Appartement démo Poto-Poto » (org Paradis Immo)
- Paiement cash **75 000 XAF** en `PENDING_VALIDATION` → visible pour l’agent sur `/agent/payments/validation`

### Premier login hors comptes seed

Un numéro inconnu crée un utilisateur avec le rôle global `TENANT` uniquement. Pour lui donner d’autres droits, modifier la base puis **se reconnecter** (les rôles sont dans le JWT).

Exemple admin :

```sql
INSERT INTO "UserRole" (id, "userId", role)
VALUES (gen_random_uuid(), 'USER_ID', 'PLATFORM_ADMIN');
```

Exemple agent (membre Paradis Immo) :

```sql
INSERT INTO "OrganizationMember" (id, "organizationId", "userId", role)
VALUES (gen_random_uuid(), 'org_paradis_immo', 'USER_ID', 'AGENT');
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
| Visites              | `/agent/visits`              |
| Baux                 | `/agent/leases`              |
| Validation paiements | `/agent/payments/validation` |
| Maintenance          | `/agent/maintenance`         |

### Propriétaire

| Page            | Route                |
| --------------- | -------------------- |
| Tableau de bord | `/owner/dashboard`   |
| Biens           | `/owner/properties`  |
| Visites         | `/owner/visits`      |
| Baux            | `/owner/leases`      |
| Paiements       | `/owner/payments`    |
| Maintenance     | `/owner/maintenance` |
| Mandat          | `/owner/mandate`     |

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
