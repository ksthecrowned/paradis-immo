# Médias riches V1 — Vidéo + mapViews (design)

Date : 2026-07-17
Statut : validé en brainstorm, en attente de plan d'implémentation

## Contexte

La fiche publique mobile et la fiche owner web n'exploitent que les photos,
alors que l'API accepte déjà les vidéos (`MediaType.VIDEO`, whitelist R2
`video/mp4` / `video/quicktime`). Les `mapViews` sont des flags sans
expérience réelle : `tour360` affiche un carrousel de photos « bientôt »,
`streetView` un placeholder.

Décisions produit :

- **Vidéo** : réellement jouable en V1 (upload owner + lecture web/mobile).
- **`tour360`** : conservé au modèle, expérience immersive reportée
  (UI « Bientôt »).
- **`streetView`** : abandonné — retiré du modèle, des UI et des routes.
- **`neighborhood`** : reste la seule vue active.

## Scope V1

### Modèle & API

- `PropertyMedia` inchangé : `type: PHOTO | VIDEO`, `url`, `position`.
  Pas de `thumbnailUrl` ni `durationMs` en V1.
- Enum Prisma `MapViewId` : retirer `streetView` ; garder
  `neighborhood` et `tour360`.
- Migration : les valeurs JSON `streetView` existantes sont ignorées en
  lecture (`toPublic` filtre les valeurs hors enum) et purgées à la
  prochaine écriture.
- Upload : endpoints existants (`/properties/:id/media/upload`, presign,
  confirm) inchangés dans leur contrat. Ils acceptent déjà les
  content-types vidéo whitelistés.
- **Limite vidéo : 20 Mo max**, formats `video/mp4` et `video/quicktime`
  uniquement (aligné whitelist R2). Rejet clair au-delà (400 avec message).

### UI Owner web (formulaire `/owner/properties/add` + edit, onglet Médias)

Option retenue : **A** (dropzone + CTA séparés, tuiles typées).

- Dropzone unique (glisser-déposer + clic).
- Deux CTA distincts : « Ajouter des photos » (`image/*`) et
  « Ajouter une vidéo » (`video/mp4,video/quicktime`) — inputs séparés.
- Grille de tuiles :
  - photo → miniature ;
  - vidéo → fond sombre, badge ▶, durée si lisible via metadata,
    sinon nom de fichier.
- Suppression par tuile (existant conservé).
- Validation client : type whitelisté + taille ≤ 20 Mo, message inline
  sinon.
- Ordre : mixte photos + vidéos, ordre d'ajout (pas de drag V1).
- Empty state : « Ajoutez des photos ou une vidéo pour valoriser le bien ».

### UI Owner web (détail `/owner/properties/[id]`)

- `MediaGallery` tient compte de `type` : vidéo → `<video controls>`,
  photo → image (lightbox photo inchangée).
- Bloc « Vues immersives » : `neighborhood` (+ `tour360` badgé « Bientôt »).
  Plus de mention Street View.

### Mobile (fiche publique)

- Galerie / preview 4 tuiles : une tuile vidéo affiche un badge ▶ et joue
  dans le lecteur natif ; photos inchangées.
- Hero `mapViews` : chip Street View supprimée ; `tour360` conduit à
  l'écran « bientôt » existant (`tour-360.tsx` conservé).
- Fichiers supprimés : `app/property/[id]/street-view.tsx` + entrée
  `_layout.tsx` + branche `streetView` de `propertyMapViewPath`.
- `types/property.ts` : `PropertyMapView = 'neighborhood' | 'tour360'`.

### Erreurs & tests

- Erreurs upload inline (type, taille, échec API).
- Tests API : upload VIDEO accepté ; vidéo > 20 Mo rejetée ;
  `streetView` filtré en lecture ; valeurs `mapViews` inconnues ignorées.
- Smoke UI : ajout photo + vidéo, lecture sur détail owner et fiche
  mobile, absence de chip Street View.

## Hors scope V1 (chantiers suivants)

- Player 360 réel (equirectangular / Matterport / Kuula), poster et durée
  vidéo générés côté API, Google Street View, drag-and-drop de
  réordonnancement, barre de progression par fichier, lightbox de
  prévisualisation avant enregistrement.

## Fichiers touchés (estimation)

| Zone | Fichiers |
|---|---|
| API | `prisma/schema.prisma` (enum MapViewId), migration, `properties.service.ts` (filtre mapViews), `dto/create-property.dto.ts`, `media.service.ts` / `media.controller.ts` (limite 20 Mo vidéo) |
| Web | `lib/owner/media.ts`, `lib/owner/properties.ts` (MapViewId, MAP_VIEWS), `owner-property-form.tsx` (onglet Médias, option A), `owner-property-detail-view.tsx`, `components/detail/MediaGallery.tsx`, `components/owner/property-media-uploader.tsx` |
| Mobile | `types/property.ts`, `lib/property-map-views.ts`, `components/property/detail/constants.ts`, `PropertyDetailMapHero.tsx`, `PropertyDetailGalleryPreview.tsx`, `app/_layout.tsx`, suppression `app/property/[id]/street-view.tsx` |
