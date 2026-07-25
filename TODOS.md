# TODOS — classé par priorité & accessibilité

> Dernière mise à jour : 25 juil. 2026. Specs dans `docs/superpowers/specs/`.

**Priorité** : P0 · P1 · P2  
**Accessibilité** : 🟢 facile · 🟡 moyen · 🔴 lourd

**Focus actif** : V3 paliers livré (local) — S4 preuve acheteur plus tard.  
**Plus tard** : S4 preuve acheteur · P2 marketplace · suivis médias.  
**Zappé** : Vue Reels · « historique portable » riche.  
**Principe** : on ne livre **pas** tout d’un coup — phases ci-dessous.

---

## P0 — Priorité haute

| # | Item | Accès | Statut |
|---|------|-------|--------|
| 1 | Rich Media V1 (vidéo + nettoyage mapViews) | 🟢 | ✅ mergé sur main |
| 2 | Frais de visite sur fiche publique | 🟢 | ✅ fait |
| 3 | Fiche confiance & contact (spec) | 🟡 | ✅ fait |
| 4 | `Mis à jour le …` (agent + popup more) | 🟡 | ✅ fait |

---

## P1 — Important (marketplace)

| # | Item | Accès | Statut |
|---|------|-------|--------|
| 5 | **Frais listing** : caution (mois), frais d’agence | 🟡 | ✅ fait |
| 6 | **Nombre de favoris actifs** (fiche publique) | 🟡 | ✅ fait |
| 7 | Nombre de vues (empreinte device) | 🔴 | ✅ fait (local) |
| 8 | Signalement (6 motifs + modération) | 🔴 | ✅ fait (local) |
| 9 | Refonte UI owner (layout hybride) | 🟡 | ✅ fait |
| 10 | Saisie `lat`/`lng` form owner | 🟢 | ✅ fait |
| 11 | Agent / agence sur détail owner web | 🟡 | ✅ fait |

### Détail P1-8 (Signalement) — fait
Motifs : Déjà vendu/loué · Annonce frauduleuse · Doublon · Informations incorrectes · Contenu inapproprié · Autre (à préciser)
Description optionnelle (requise si Autre) · API + stockage · vue modération admin `/admin/reports`

### Détail P1-9 (Refonte UI owner) — fait
Header compact (titre, type·mode, prix, badges) → bandeau médias → 2 colonnes (contenu / sidebar sticky Actions·Marché·Visite·Gestionnaire).

---

## Fil « Paiements & dossiers » — vision complète

### Règles produit (figées)

- Owner/agent voit les paiements **MoMo (ou autre provider)** **et** peut **valider manuellement** un paiement depuis le dashboard.
- Locataire (mobile) : espace **« Mon cahier de loyer »** — suivi de ses échéances / paiements.
- Owner/agent voit la **date de création** du compte locataire.
- **Solvabilité locataire** : le nouveau logeur **demande** l’accès aux **3 derniers loyers payés** ; le locataire **valide** ; accès **7 jours** (snapshot figé).
- **Vente par paliers** : owner configure l’échéancier des acomptes ; **chaque palier** = paiement (MoMo ou validation manuelle), même moteur que le loyer.

Prérequis déjà en place : bail pour locataire avec **ou sans** compte Paradis Immo · brouillon · échéancier loyer · paiements owner de base.

---

### Phase Locative V1 — focus actif

| # | Item | Accès | Statut |
|---|------|-------|--------|
| L0 | Spec design V1 (API + UI owner + mobile cahier, droits mandat) | 🟡 | ✅ |
| L1 | Liste « Mes locataires » (baux gérés : nom, tél., bien, statut, `createdAt` compte) | 🟡 | ✅ |
| L2 | Fiche locataire (identité, contacts, baux liés, liens paiements) | 🟡 | ✅ |
| L3 | Suivi paiements par bail — échéancier, retards, historique ; **voir** MoMo / autres | 🟡 | ✅ |
| L4 | **Validation manuelle** paiement (owner/agent dashboard) | 🟡 | ✅ |
| L5 | Mobile : **Mon cahier de loyer** (échéances + paiements du locataire) | 🔴 | ✅ |

Ordre V1 : **L0** → L1 → L2 → L3 → L4 → L5.

---

### Phase Locative V1.1 — documents

| # | Item | Accès | Statut |
|---|------|-------|--------|
| D1 | Documents locataire (pièces d’identité, etc.) | 🔴 | ✅ |
| D2 | Contrats / pièces de bail (PDF signé, avenants) | 🔴 | ✅ |

---

### Phase Locative V2 — vérification de solvabilité

> Spec : `docs/superpowers/specs/2026-07-25-tenant-solvency-check-design.md`

| # | Item | Accès | Statut |
|---|------|-------|--------|
| H0 | Spec design (demande owner, consentement, 3 loyers, 7 j) | 🟡 | ✅ |
| H1 | API `SolvencyCheck` + droits + snapshot | 🔴 | ✅ |
| H2 | Locataire (mobile) : accepter / refuser la demande | 🔴 | ✅ |
| H3 | Owner web : bloc Solvabilité sur fiche locataire | 🔴 | ✅ |

---

### Phase Vente V3 — achat par paliers

> Spec : `docs/superpowers/specs/2026-07-25-sale-installments-design.md`

| # | Item | Accès | Statut |
|---|------|-------|--------|
| S0 | Spec échéancier de vente (paliers, montants, dates, statut) | 🟡 | ✅ |
| S1 | Owner configure les paliers sur un dossier vente (bien + acheteur) | 🔴 | ✅ |
| S2 | Paiement par palier (MoMo / autre) + **validation manuelle** owner | 🔴 | ✅ |
| S3 | Acheteur (mobile) : suivi de ses paliers (miroir du cahier de loyer) | 🔴 | ✅ |
| S4 | (Plus tard) preuve de paiements acheteur | 🔴 | ⬜ |

---

## P2 — Plus tard (marketplace)

| # | Item | Accès |
|---|------|-------|
| 12 | Court séjour (`RENT_SHORT` règles, check-in, couchages) | 🔴 |
| 13 | Profil agent riche (API) : spécialité, années d’exp., délai de réponse | 🔴 |
| 14 | Quartier réel (POI) | 🔴 |
| 15 | Preuve sociale (avis / notes) | 🔴 |

---

## Suivis médias V1

Spec : `docs/superpowers/specs/2026-07-17-rich-media-video-mapviews-design.md`

Player 360 réel (`tour360` en « Bientôt ») · posters/durée vidéo · drag-reorder · progression upload · lightbox prévisualisation · contrôle taille presign/confirm

---

## Reliquats mineurs

Test boundary 20 Mo + `video/quicktime` · migration mapViews legacy · `PropertyDocument` sur fiche publique si voulu · migrations views / listing fees hors local au déploiement

---

## État

Vision **paiements & dossiers** : V1 ✅ → V1.1 docs ✅ → V2 solvabilité ✅ → **V3 paliers ✅ (local)** · S4 plus tard. Reels retiré.
