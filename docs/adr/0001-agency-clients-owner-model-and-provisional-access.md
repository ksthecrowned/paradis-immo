# ADR-0001 — Clients d’agence, propriétaire de bien et accès provisoire

- **Statut** : Accepted
- **Date** : 2026-10-16
- **Décideurs** : produit / engineering Paradis Immo
- **Périmètre** : API, web, données, autorisations, mandats, admin plateforme

## Contexte

Une agence doit gérer un portefeuille de propriétaires avec ou sans compte Paradis Immo, rattacher un bien à un client, et prouver un mandat (acceptation plateforme ou dépôt de pièce hors plateforme). Le modèle actuel force `Property.ownerId` vers un `User` et crée souvent un compte artificiel via téléphone ; `AgencyAccessService` n’autorise l’exploitation qu’avec un mandat `ACTIVE` / `TERMINATING`, ce qui bloque la préparation du bien pendant l’attente.

Les notions suivantes doivent rester distinctes : fiche CRM, compte utilisateur, propriétaire déclaré d’un bien, statut de mandat, revue documentaire plateforme, droit opérationnel.

## Options envisagées

- **Option A — Faux compte User pour chaque contact externe** — simple à brancher sur `ownerId`, mais pollue l’identité, l’OTP, le KYC et les surfaces OWNER ; fusion ultérieure risquée.
- **Option B — CRM `AgencyClient` + `ownerId` nullable + accès provisoire orthogonal au consentement** — modèle explicite ; migration et contrôles d’accès plus complexes.
- **Statu quo** — impossible de représenter correctement un propriétaire sans compte ni d’opérer pendant l’attente sans mentir sur le statut du mandat.

## Décision

Adopter l’option B.

1. **CRM** : modèle `AgencyClient` par agence (contact externe ou lié à un `userId` nullable). Isolation multi-agence ; une seule relation active par couple agence/compte ; pas de fusion automatique sur numéro.
2. **Propriétaire de bien** : `Property.agencyClientId` pour le client CRM de l’agence gestionnaire ; `Property.ownerId` nullable (présent pour biens auto-déclarés OWNER et clients liés). Contrainte métier : exactement une identité propriétaire valide (User et/ou AgencyClient cohérents). `Property.organizationId` reste l’org propriétaire/gestionnaire selon les règles existantes des biens externes.
3. **Deux axes orthogonaux** :
   - **Validation / preuve du mandat** : acceptation authentifiée du propriétaire (parcours virtuel) **ou** revue documentaire plateforme (`APPROVED` | `NEEDS_CORRECTION` | `REJECTED`) pour pièce hors plateforme.
   - **Accès opérationnel provisoire** : pendant l’attente (proposition / revue en cours / `NEEDS_CORRECTION`), l’agence peut préparer/modifier le bien, publier, organiser des visites et gérer le locatif, sous assignation et appartenances ACTIVE. Les approbations owner existantes, ventes et finance ne sont pas élargies.
4. **Fin d’attente négative** : refus propriétaire, rejet définitif documentaire, expiration ou révocation → révoquer l’accès provisoire et passer l’annonce en `PAUSED` (historique conservé). `NEEDS_CORRECTION` ne révoque pas l’accès.
5. **Permissions** : ADMIN d’agence seul pour CRM et dépôt/remplacement des mandats papier ; AGENT : sélection des clients de son agence et biens assignés.
6. **Ajout CRM d’un compte existant** : lookup minimal par téléphone ; notification d’information au compte ; n’ouvre pas les biens et ne vaut pas acceptation de mandat.
7. **Rattachement contact → compte** : OTP + confirmation explicite du propriétaire ; jamais automatique.

## Conséquences

### Positives

- Pas de faux utilisateurs ; traçabilité claire CRM / mandat / revue / accès.
- L’agence peut préparer le portefeuille sans présenter un mandat comme signé.
- La revue plateforme reste documentaire, sans prétendre certifier juridiquement la signature.

### Négatives / coûts acceptés

- Complexité de `AgencyAccessService` et migration additive (`ownerId` nullable).
- Surfaces OWNER inapplicables aux contacts externes tant qu’ils n’ont pas de compte.
- Annonces publiées pendant l’attente peuvent être mises en `PAUSED` après refus/rejet.

### À surveiller

- Contournements via routes secondaires ou URLs présignées après révocation.
- Backfill des biens historiques créés via `ownerPhone` (rapport, pas mutation silencieuse).
- Distinction initiateur de mandat (OWNER → agence vs agence → client lié).

## Mise en œuvre et validation

- Applications/domaines : `agency-clients`, `properties`, `mandates`, `admin`, `AgencyAccessService` et consommateurs, web agent/owner/admin.
- Migrations : additives ; pas de conversion automatique des mandats `ACTIVE` historiques.
- Tests : matrice rôle × action × état ; isolation multi-agence ; transitions refus/rejet/correction.
- Rollback : feature flag sur nouvelle création agence ; schéma additif lisible en dual-run.

## Références

- Plan : `docs/superpowers/plans/2026-10-16-agency-clients-and-mandate-evidence.md`
- Specs : 02, 03, 12, 15 ; exigences fichiers/consentement : 16
