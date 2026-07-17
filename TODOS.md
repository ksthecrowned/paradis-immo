# TODOS — classé par priorité & accessibilité

> Synthèse des discussions (17 juil. 2026). Specs/plans dans
> `docs/superpowers/specs/` et `docs/superpowers/plans/`.
>
> **Priorité** : P0 (à faire vite) · P1 (important) · P2 (plus tard)
> **Accessibilité** : 🟢 facile · 🟡 moyen · 🔴 lourd (nouveau modèle / infra)

---

## P0 — Priorité haute

| # | Item | Accès | Notes |
|---|------|-------|-------|
| 1 | **Merger `feat/rich-media-video-mapviews`** | 🟢 | Smoke test manuel (upload photo/vidéo owner, lecture web+mobile, plus de chip Street View) → push + PR |
| 2 | **Frais de visite sur fiche publique** | 🟢 | Champ `visitPrice` existe déjà, juste l'affichage |
| 3 | **Fiche confiance & contact** (spec écrite) | 🟡 | `docs/.../2026-07-17-public-listing-trust-contact-design.md` — écrire le plan puis exécuter |
| 4 | **`Mis à jour le …`** (bloc agent + popup more) | 🟡 | Mapper `updatedAt` dans `Property` mobile (`map-property.ts`, `types/property.ts`) |

### Détail P0-3 / P0-4 (Fiche confiance & contact)
- [ ] Carte **Agence** (logo/couleur, nom + lien, adresse, tél, note/avis si dispo)
- [ ] Carte **Agent** (avatar, nom, rôle, spécialité/exp. si dispo, tél, nb annonces)
- [ ] `Mis à jour le …` bas du bloc Agent **et** en tête de la popup « more »
- [ ] Nouveau composant `PropertyDetailContact.tsx`

---

## P1 — Important

| # | Item | Accès | Notes |
|---|------|-------|-------|
| 5 | **Frais listing** : caution (mois), frais d'agence | 🟡 | Nouveaux champs Property + form owner + affichage public |
| 6 | **Nombre de favoris actifs** | 🟡 | Modèle `Favorite` existe, exposer le compteur |
| 7 | **Nombre de vues** (dédup empreinte device) | 🔴 | Nouveau tracking + stockage |
| 8 | **Signalement** (6 motifs + desc. optionnelle) | 🔴 | API + stockage + vue modération admin |
| 9 | **Refonte UI owner** (layout hybride « approche 3 ») | 🟡 | Détail + add/edit, header compact, sidebar sticky |
| 10 | **Saisie `lat`/`lng` dans le form owner** | 🟢 | Champ API existant, non exposé — prérequis « quartier réel » |
| 11 | **Agent/agence sur détail owner web** | 🟡 | Type TS web n'expose pas `agent` |

### Détail P1-8 (Signalement) — motifs
- Déjà vendu/loué · Annonce frauduleuse · Doublon · Informations incorrectes · Contenu inapproprié · Autre (à préciser)

### Détail P1-9 (Refonte UI owner)
- [ ] Détail : header compact (titre, type·mode, prix, badges) → bandeau médias → 2 colonnes
- [ ] Détail : blocs Gestionnaire/Agence + carte + métriques clés
- [ ] Add/edit : aligner sur les mêmes blocs

---

## P2 — Plus tard

| # | Item | Accès | Notes |
|---|------|-------|-------|
| 12 | **Vue Reels** (feed vidéo vertical public) | 🔴 | Exploite les vidéos uploadées |
| 13 | **Court séjour** (`RENT_SHORT`) | 🔴 | Règles maison, check-in, capacité max, couchages |
| 14 | **Profil agent riche (API)** | 🔴 | Spécialité, années d'exp., délai de réponse en base |
| 15 | **Quartier réel** (POI, plus de mock) | 🔴 | Prérequis : saisie fiable `lat`/`lng` (voir #10) |
| 16 | **Preuve sociale** (avis / notes ou volume contacts) | 🔴 | Nouveau modèle |

---

## Suivis médias V1 (backlog, hors scope volontaire)

Spec : `docs/superpowers/specs/2026-07-17-rich-media-video-mapviews-design.md`

| Item | Accès |
|------|-------|
| Player 360 réel (equirectangular / Matterport / Kuula) — `tour360` en « Bientôt » | 🔴 |
| Poster/thumbnail + durée vidéo générés côté API | 🟡 |
| Drag-and-drop réordonnancement des médias | 🟡 |
| Barre de progression par fichier à l'upload | 🟡 |
| Lightbox de prévisualisation avant enregistrement | 🟡 |
| Contrôle de taille sur le flux presign/confirm (seul multipart limité) | 🟢 |

---

## Reliquats mineurs (reviews internes)

| Item | Accès |
|------|-------|
| Test limite exacte 20 Mo (boundary) + test upload `video/quicktime` | 🟢 |
| Migration mapViews : robustesse si JSON legacy malformé (non-array) | 🟢 |
| Exposer les `PropertyDocument` (titre foncier, plan) sur la fiche si voulu produit | 🟡 |
