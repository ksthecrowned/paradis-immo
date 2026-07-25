# Nombre de vues par annonce (empreinte device) — Design

> Statut : validé (réponses utilisateur du 17 juil. 2026). TODO P1 #7.

## Objectif

Compter le nombre de consultations uniques d'une fiche publique et l'afficher
comme preuve sociale (fiche publique mobile) et comme métrique owner (détail
owner web).

## Décisions produit

| Question | Décision |
|----------|----------|
| Déduplication | **1 vue par identité et par jour** (jour UTC) |
| Identité | **Compte connecté d'abord** (`user:<id>`), sinon identifiant d'installation persistant (`device:<installId>`) |
| Vues du propriétaire / membres de l'agence gestionnaire | **Exclues** |
| Affichage | Fiche publique mobile (badge « N vues » dans la rangée confiance) + détail owner web (sidebar Marché) |
| Statut annonce | Seules les annonces `ACTIVE` sont comptées |

## Modèle de données (Prisma)

```prisma
model PropertyView {
  id         String   @id @default(uuid())
  propertyId String
  property   Property @relation(fields: [propertyId], references: [id])
  viewerKey  String   // "user:<userId>" ou "device:<installId>"
  viewDate   DateTime @db.Date // jour UTC — bucket de déduplication
  createdAt  DateTime @default(now())

  @@unique([propertyId, viewerKey, viewDate])
}
```

La contrainte unique porte la déduplication (même approche que `Favorite` /
`idempotencyKey`) : l'insertion utilise `createMany({ skipDuplicates: true })`.

## API

### `POST /api/v1/properties/:id/views` (public)

- Auth optionnelle (`@OptionalUser`) : si JWT présent → `viewerKey = user:<userId>` ;
  sinon `deviceId` requis dans le body → `viewerKey = device:<deviceId>`.
- Body : `{ deviceId?: string }` (1–64 caractères).
- Réponse : `{ counted: boolean }`.
- `counted: false` si : annonce non `ACTIVE`, utilisateur = owner ou membre de
  l'organisation gestionnaire, ou vue déjà enregistrée aujourd'hui.
- 400 si ni JWT ni `deviceId` ; 404 si l'annonce n'existe pas.

### `viewCount` dans `PublicProperty`

`GET /properties` et `GET /properties/:id` exposent `viewCount: number` via
`_count.views` (même mécanique que `favoriteCount`).

## Clients

### Mobile

- `lib/device-id.ts` : `getInstallId()` — identifiant aléatoire persistant
  (AsyncStorage `paradisImmo.installId`).
- `lib/property-views.ts` : `recordPropertyView(propertyId)` — POST
  fire-and-forget (jamais bloquant, erreurs silencieuses) ; token joint si
  connecté, `deviceId` toujours envoyé en secours.
- Écran fiche `app/property/[id]/index.tsx` : enregistrement après chargement
  réussi, une fois par montage d'écran.
- Affichage : badge « N vues » (icône œil) dans `PropertyDetailMapHero`, à côté
  du badge favoris.

### Web owner

- `viewCount` (et `favoriteCount`) ajoutés au type `PublicProperty` web.
- Détail owner : lignes « Vues » et « Favoris » dans la section sidebar
  « Marché ».

## Hors scope

- Web public (pas de fiche marketplace web aujourd'hui).
- Agrégats vues dans `owner/stats` ou l'admin.
- Anti-abus au-delà du throttling global existant (100 req/min).

## Tests

- API (`property-views.spec.ts`, Jest + supertest, DB réelle) : comptage,
  déduplication quotidienne, exclusion owner/membre org, 400 sans identité,
  `viewCount` dans le GET public.
- Mobile (`bun:test`) : mapping `viewCount` dans `map-property.test.ts`.
