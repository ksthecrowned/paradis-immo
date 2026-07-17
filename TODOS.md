# TODOS — classé par priorité & accessibilité

> Dernière mise à jour : 17 juil. 2026. Specs dans `docs/superpowers/specs/`.

**Priorité** : P0 · P1 · P2  
**Accessibilité** : 🟢 facile · 🟡 moyen · 🔴 lourd

---

## P0 — Priorité haute

| # | Item | Accès | Statut |
|---|------|-------|--------|
| 1 | Merger `feat/rich-media-video-mapviews` | 🟢 | ⏳ toi (smoke + PR) |
| 2 | Frais de visite sur fiche publique | 🟢 | ✅ fait |
| 3 | Fiche confiance & contact (spec) | 🟡 | ✅ fait |
| 4 | `Mis à jour le …` (agent + popup more) | 🟡 | ✅ fait |

---

## P1 — Important

| # | Item | Accès | Statut |
|---|------|-------|--------|
| 5 | **Frais listing** : caution (mois), frais d’agence | 🟡 | ✅ fait |
| 6 | **Nombre de favoris actifs** (fiche publique) | 🟡 | ✅ fait |
| 7 | Nombre de vues (empreinte device) | 🔴 | ⬜ |
| 8 | Signalement (6 motifs + modération) | 🔴 | ⬜ |
| 9 | Refonte UI owner (layout hybride) | 🟡 | ⬜ |
| 10 | Saisie `lat`/`lng` form owner | 🟢 | ✅ fait |
| 11 | Agent / agence sur détail owner web | 🟡 | ✅ fait |

### Détail P1-8 (Signalement)
Déjà vendu/loué · Annonce frauduleuse · Doublon · Informations incorrectes · Contenu inapproprié · Autre

### Détail P1-9 (Refonte UI owner)
Header compact → bandeau médias → 2 colonnes · Gestionnaire/Agence · add/edit alignés

---

## P2 — Plus tard

| # | Item | Accès |
|---|------|-------|
| 12 | Vue Reels | 🔴 |
| 13 | Court séjour (`RENT_SHORT` règles, check-in, couchages) | 🔴 |
| 14 | Profil agent riche (API) | 🔴 |
| 15 | Quartier réel (POI) | 🔴 |
| 16 | Preuve sociale (avis / notes) | 🔴 |

---

## Suivis médias V1

Player 360 · posters vidéo · drag-reorder · progression upload · limite presign

---

## Reliquats mineurs

Tests boundary 20 Mo · migration mapViews JSON · PropertyDocument sur fiche

---

## Notes dev (non commités — toi)

- **Mobile** : contact, frais visite, frais listing, favoris, `updatedAt`
- **Web owner** : lat/lng, gestionnaire, champs Marché (caution / frais agence)
- **API** : `depositMonths`, `agencyFeeAmount`, `favoriteCount` — migration `20260717071000_property_listing_fees` → `cd apps/api && bun prisma migrate dev`
