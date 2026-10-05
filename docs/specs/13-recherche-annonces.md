# 13 — Recherche, annonces et documents du bien

## Objectif et rôles
Permettre aux chercheurs de trouver vite le bon bien (filtres complets, texte, carte, tri, alertes), aux gestionnaires de publier des annonces de qualité, et protéger les documents sensibles des biens.
Rôles : `SEEKER` (anonyme ou connecté), `OWNER`, `MANAGER`, `AGENT`, `PLATFORM_ADMIN`.

## État actuel (audit)
- **`GET properties`** (`FilterPropertiesDto`)
  - Filtres disponibles : `mode`, `status`, `countryCode`, `cityId`, `arrondissementId`, `quartierId`, `organizationId`, `minPrice`, `maxPrice`, `limit`, `offset`.
  - Tri unique : `createdAt desc`.
  - **Absents** : type de bien, chambres, salles de bain, surface, équipements (`features`), meublé, disponibilité à une date (séjours), statut d'annonce (`listingStatus`), recherche texte, recherche géographique (rayon ou bbox de carte), tri par prix ou pertinence, « vedettes d'abord ».
- **Statut de publication** : il n'y a pas de filtre serveur visible pour exclure les `listingStatus` OCCUPIED et SOLD de la recherche publique (à vérifier). Les annonces louées ou vendues restent trouvables.
- **Documents** : `GET properties/:id/documents` **n'a aucun guard**. Titres fonciers (`TITLE_DEED`) et plans sont accessibles publiquement, et `PropertyDocument.url` est probablement une URL R2 directe.
- **Médias** : presign et confirmation R2, photos et vidéos. Pas de réordonnancement visible côté API (`position` existe), pas de photo de couverture explicite, pas de compression ni de miniatures, pas de visite 360° réelle (`MapViewId.tour360` est factice, « 360° (bientôt) » côté web et mobile).
- **Vues** : `recordView` existe. Pas de statistiques d'annonce exposées au gestionnaire (vues, favoris, contacts).
- Pas d'alertes de recherche ni de recherches sauvegardées. Pas de biens similaires.
- Mobile : pas de pagination sur la liste, et les favoris sont chargés en N+1 (14).

## User stories
1. En tant que chercheur, je filtre par :
   - mode, type, ville, quartier(s) (multi-sélection) ;
   - prix minimum et maximum, chambres minimum, salles de bain minimum, surface minimum ;
   - équipements (tous requis) ;
   - meublé ;
   - disponible à partir du…, ou dates de séjour avec nombre de voyageurs ;
   - visite gratuite ou payante ;
   - agence vérifiée.
2. Je tape un texte libre (« villa piscine Bacongo ») et j'obtiens des résultats pertinents, tolérants aux accents et aux fautes légères.
3. Je cherche sur la carte : les résultats suivent la zone affichée (bbox), avec des clusters de marqueurs. Je cherche aussi « autour de moi » (rayon).
4. Je trie par pertinence, prix croissant ou décroissant, plus récents, surface.
5. Je sauvegarde ma recherche et j'active une alerte (immédiate ou quotidienne) pour les nouvelles annonces et les baisses de prix correspondantes.
6. Sur une fiche, je vois des biens similaires (même quartier ou quartier voisin, même type, prix à ±20 %).
7. En tant que gestionnaire, je vois les performances de chaque annonce : vues, favoris, contacts (messages, demandes, visites), taux de conversion, et position moyenne dans les résultats.
8. En tant que gestionnaire, je réordonne les photos, je choisis la couverture, je légende par pièce. Les photos sont compressées, et leur nombre minimum et leur résolution sont vérifiés (score de qualité de l'annonce).
9. En tant que gestionnaire, j'ajoute une visite virtuelle (URL Matterport, Kuula, ou vidéo 360 hébergée) qui remplace la vue 360° factice.
10. En tant que propriétaire, mes documents (titre foncier, plans) ne sont visibles que par moi, mon agence mandatée, et les acheteurs ou locataires à qui je les partage explicitement (après une offre acceptée, par exemple).
11. En tant que chercheur, je partage une annonce par lien (deep link universel) qui ouvre l'app ou le web (14).
12. En tant que chercheur, je vois l'historique de prix (baisses) et la mention « Publié il y a X jours ».

## Règles métier
- **Visibilité publique** : `status = ACTIVE` ET `moderationStatus = APPROVED` (12) ET `listingStatus ∈ {AVAILABLE, AVAILABLE_SOON, UNDER_OFFER}`. `UNDER_OFFER` est affiché avec un badge, et masquable par filtre. OCCUPIED et SOLD sont exclus. Organisation non suspendue.
- **Recherche texte**
  - Postgres FTS (`tsvector` avec configuration `french` et `unaccent`) sur le titre, la description, le quartier et la ville, avec `pg_trgm` pour la tolérance aux fautes.
  - Passage à Meilisearch ou Typesense si le volume dépasse 50 000 annonces (P2).
- **Géo**
  - `lat` et `lng` obligatoires à la publication (aujourd'hui optionnels). Index PostGIS `geography(Point)`, ou index `cube`/`earthdistance`.
  - `bbox=minLng,minLat,maxLng,maxLat`, ou `near=lat,lng&radiusKm=`.
  - **Confidentialité** : la position publique est floutée à environ 200 m (offset déterministe par bien) tant qu'il n'y a pas de visite confirmée ou de réservation. L'adresse exacte reste masquée.
- **Dates de séjour** : le filtre `checkIn`, `checkOut`, `guests` exclut les biens indisponibles selon les règles de 07.
- **Pertinence** : score = texte + bonus vedette (`isFeatured`) + bonus qualité de l'annonce + fraîcheur − pénalité de signalements. Les vedettes sont limitées à 3 par page pour ne pas saturer.
- **Pagination** : `limit` ≤ 50. Le mobile passe en défilement infini, et le cursor est préféré à l'offset pour le tri par date (P2).
- **Alertes** : `SavedSearch` contient le JSON des filtres. Un job quotidien (ou immédiat à la publication si fréquence `INSTANT`) fait correspondre les nouvelles annonces et les baisses de prix de plus de 5 %. Un même bien n'est notifié qu'une fois par recherche sauvegardée. 10 alertes au maximum par utilisateur.
- **Historique de prix** : chaque modification de `price` crée `PropertyPriceHistory`.
- **Qualité de l'annonce** (0-100) : ≥ 5 photos (30), description ≥ 300 caractères (15), géolocalisation (15), surface et chambres renseignées (10), équipements (10), visite virtuelle ou vidéo (10), créneaux de visite (10). Publication refusée sous 40, si le flag est activé.
- **Médias**
  - Miniatures générées (400 px, 1 200 px) en WebP à la confirmation. Taille maximale : photo 15 Mo, vidéo existante.
  - EXIF supprimé (vie privée, position GPS).
- **Documents**
  - **Privés** : stockage R2 privé et URL signée de 5 minutes, sans URL publique stockée.
  - Accès : propriétaire, gestionnaires via `AgencyAccessService`, ou `PropertyDocumentShare` (userId, expiration).
  - `DocumentType` étendu : `TITLE_DEED`, `PLAN`, `CADASTRE`, `TAX_RECEIPT`, `DIAGNOSTIC`, `INSURANCE`, `OTHER`. Un drapeau `isPublic` permet de rendre publics certains documents (plan) au choix du propriétaire.
- **Statistiques** : `PropertyView` (existant), plus des compteurs dérivés agrégés chaque nuit dans `PropertyDailyStat`.

## Modèle de données
```prisma
enum SavedSearchFrequency { INSTANT DAILY WEEKLY OFF }
enum DocumentType { TITLE_DEED PLAN CADASTRE TAX_RECEIPT DIAGNOSTIC INSURANCE OTHER }

model Property {
  // + champs
  furnished      Boolean?
  virtualTourUrl String?
  coverMediaId   String?
  qualityScore   Int      @default(0)
  publishedAt    DateTime?
  publicLat      Float?   // position floutée
  publicLng      Float?
  searchVector   Unsupported("tsvector")?
  // lat/lng : requis à la publication (règle applicative)
}

model PropertyMedia {
  // + champs
  caption     String?
  room        String?
  thumbKey    String?
  mediumKey   String?
  width       Int?
  height      Int?
}

model PropertyDocument {
  // url → fileKey (privé)
  fileKey  String
  isPublic Boolean @default(false)
  uploadedById String?
}

model PropertyDocumentShare { id String @id @default(cuid()) documentId String userId String grantedById String expiresAt DateTime? createdAt DateTime @default(now()) @@unique([documentId, userId]) }

model PropertyPriceHistory { id String @id @default(cuid()) propertyId String oldPrice Decimal newPrice Decimal changedAt DateTime @default(now()) changedById String? }

model SavedSearch {
  id         String               @id @default(cuid())
  userId     String
  name       String
  filters    Json
  frequency  SavedSearchFrequency @default(DAILY)
  lastRunAt  DateTime?
  createdAt  DateTime             @default(now())
}

model SavedSearchHit { savedSearchId String propertyId String notifiedAt DateTime @default(now()) @@id([savedSearchId, propertyId]) }

model PropertyDailyStat {
  propertyId   String
  date         DateTime @db.Date
  views        Int @default(0)
  favorites    Int @default(0)
  messages     Int @default(0)
  inquiries    Int @default(0)
  visitBookings Int @default(0)
  impressions  Int @default(0)
  @@id([propertyId, date])
}
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| GET | `properties` | public | **Modifié** : ajout de `type`, `quartierIds[]`, `minBedrooms`, `minBathrooms`, `minSurface`, `features[]`, `furnished`, `availableFrom`, `checkIn`, `checkOut`, `guests`, `visitType`, `verifiedOnly`, `includeUnderOffer`, `q`, `bbox`, `near`, `radiusKm`, `sort=relevance\|price_asc\|price_desc\|newest\|surface`. Visibilité publique forcée |
| GET | `properties/map` | public | Mêmes filtres, réponse légère `{ id, publicLat, publicLng, price, mode }` pour les clusters (max 500) |
| GET | `properties/suggest` | public | `?q=` : autocomplétion (quartiers, villes, titres) |
| GET | `properties/:id/similar` | public | 6 biens |
| GET | `properties/:id/price-history` | public | |
| GET | `properties/:id/stats` | gestionnaire | `?from&to` : séries quotidiennes |
| PATCH | `properties/:id/media/order` | gestionnaire | `{ mediaIds[] }`, plus `coverMediaId` |
| PATCH | `properties/:id/media/:mediaId` | gestionnaire | `{ caption, room }` |
| GET | `properties/:id/quality` | gestionnaire | Score et checklist |
| GET | `properties/:id/documents` | **guard** : propriétaire, gestionnaire, partage | **Modifié** : URL signées, `isPublic` visibles par tous |
| POST | `properties/:id/documents/:docId/shares` | propriétaire / gestionnaire | `{ userId, expiresAt }` |
| DELETE | `properties/:id/documents/:docId/shares/:userId` | idem | |
| CRUD | `users/me/saved-searches` | auth | Recherches sauvegardées et alertes |

## Écrans
- **Mobile**
  - Recherche : barre texte avec autocomplétion, feuille de filtres complète, chips de filtres actifs, tri.
  - Bascule liste ↔ carte avec clusters et « rechercher dans cette zone ».
  - Défilement infini.
  - « Sauvegarder cette recherche » avec choix de fréquence. `profile/saved-searches`.
  - Fiche du bien : galerie ordonnée avec légendes, visite virtuelle (WebView) à la place du 360° factice, historique de prix, biens similaires, partage.
- **Web, public** (landing ou listing) : mêmes filtres, URL partageables (filtres dans la query string), SEO (pages ville et quartier, `schema.org/Residence`).
- **Web, gestionnaire**
  - `property-form` : glisser-déposer pour l'ordre des photos, couverture, légendes, URL de visite virtuelle, géolocalisation obligatoire (sélection sur carte), jauge de qualité.
  - Fiche du bien : onglet « Performance » (graphiques des vues et contacts) et onglet « Documents » (privé, partages).

## Critères d'acceptation
- `GET properties/:id/documents` sans authentification ne renvoie que les documents `isPublic`, avec URL signées. Un `TITLE_DEED` n'est jamais renvoyé à un tiers non autorisé (test de sécurité).
- Les annonces `OCCUPIED` ou `SOLD` n'apparaissent pas dans `GET properties`.
- `?minBedrooms=3&features=piscine,parking` ne renvoie que des biens qui ont au moins 3 chambres ET les deux équipements.
- `?q=bacongo villa` trouve « Villa à Bacongo » ; `?q=bacnogo` la trouve aussi (trigram).
- `?bbox=` ne renvoie que des biens dont `publicLat` et `publicLng` sont dans la boîte. La position publique diffère de la position réelle (offset compris entre 100 et 250 m).
- `?checkIn&checkOut` exclut un bien qui a un booking CONFIRMED sur ces dates.
- Une nouvelle annonce correspondant à une recherche `INSTANT` déclenche une seule notification `SEARCH_ALERT`.
- Une baisse de prix de 10 % crée `PropertyPriceHistory` et déclenche les alertes.
- Les photos confirmées ont des miniatures WebP et aucune donnée EXIF GPS.

## Priorité
- **P0** : guard et URL signées sur les documents, exclusion des biens OCCUPIED et SOLD de la recherche publique.
- **P1** : filtres complets (type, chambres, surface, équipements, dates de séjour), tri, recherche texte, recherche sur carte (bbox) et position floutée, pagination et défilement infini mobile, ordre des médias et couverture, statistiques d'annonce.
- **P2** : alertes et recherches sauvegardées, biens similaires, historique de prix, score de qualité, visite virtuelle, miniatures et suppression EXIF, SEO, partage de documents.
