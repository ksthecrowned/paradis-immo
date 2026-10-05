# 02 — Organisations, agences et équipes

## Objectif et rôles
Permettre à une agence de s'inscrire, d'être affiliée, de gérer son équipe et sa vitrine publique. Le propriétaire particulier dispose de son organisation de type OWNER.
- Rôles : `MANAGER`, qui administre l'agence ; `AGENT` ; `OWNER` ; `PLATFORM_ADMIN`, qui valide l'affiliation.

## État actuel (audit)
- `Organization` contient `type` (PLATFORM, AGENCY, OWNER), `affiliationStatus` (PENDING, APPROVED, SUSPENDED), `verified`, et des champs vitrine (shortName, tagline, logoColor, foundedYear, `rating`, `reviewCount`, `dealSuccessPercent`).
- Aucun endpoint de création ou de modification d'organisation. Aucune invitation, aucune gestion des membres.
- Le choix du rôle web (`auth/web/role`) crée l'org implicitement. Pour l'agent, il rattache au mécanisme `ensureAgentMembership` (faille, voir 01).
- `OrganizationReview` est seedé : `authorName` en texte libre, `rating` et `reviewCount` statiques sur l'org, pas de `POST`.
- Pas de logo (seulement une couleur), pas de zones d'intervention, pas d'horaires.

## User stories
1. En tant que gérant, je crée mon agence (nom, RCCM, NIU, adresse, ville, téléphone, logo). Elle reste `PENDING` jusqu'à validation par l'admin.
2. J'invite un collaborateur par téléphone ou e-mail en choisissant son rôle (ADMIN ou AGENT). Il reçoit un lien ou un SMS et rejoint l'agence après acceptation.
3. Je change le rôle d'un membre, je le désactive, ou je le retire. Ses mandats assignés doivent alors être réassignés.
4. Je modifie la vitrine publique : logo, description, zones couvertes (quartiers), horaires, réseaux.
5. En tant qu'agent, j'appartiens éventuellement à plusieurs agences et je choisis l'agence active (le `role-switcher` existe déjà côté web).
6. En tant que client ayant eu une interaction réelle (bail terminé, séjour COMPLETED, vente COMPLETED, visite COMPLETED), je laisse un avis sur l'agence.
7. En tant qu'agence, je réponds publiquement à un avis et je peux le signaler.
8. En tant que propriétaire particulier, mon org OWNER est créée automatiquement à l'onboarding. Elle n'est pas listée publiquement comme agence.

## Règles métier
- **Création d'agence**
  - `type = AGENCY`, `affiliationStatus = PENDING`, et le créateur devient membre `ADMIN`.
  - Tant que l'agence est PENDING : création de brouillons possible, mais pas de publication d'annonce ni d'acceptation de mandat.
  - `SUSPENDED` : annonces passées en `PAUSED`, aucune nouvelle action. Les baux en cours restent consultables.
- **Invitations**
  - Validité de 7 jours, à usage unique, liées à un téléphone ou un e-mail cible.
  - Si le destinataire n'a pas de compte, il le crée via OTP ou magic link, puis l'invitation s'applique.
  - Une seule invitation PENDING par cible et par org.
- **Membres**
  - Au moins un membre ADMIN actif par agence : on ne peut pas retirer ou rétrograder le dernier.
  - Retirer un agent : `Mandate.assignedAgentId` repasse à null (les mandats retournent au gérant), avec une notification au gérant.
- **Permissions**
  - ADMIN : tout dans l'org, dont équipe, vitrine, finances et attribution des mandats.
  - AGENT : biens et mandats assignés seulement, sans accès aux finances globales de l'agence.
- **Avis**
  - Note de 1 à 5 et commentaire de 20 à 1 000 caractères.
  - Un avis par interaction éligible (`sourceType` + `sourceId` uniques).
  - L'avis est publié après modération automatique (filtre de mots) et peut être signalé.
  - `rating` et `reviewCount` sont recalculés (moyenne) à chaque création ou suppression : plus aucune valeur statique.
  - `dealSuccessPercent` est calculé : ventes et baux conclus rapportés aux demandes reçues sur 12 mois.
- **Zones d'intervention** : `OrganizationServiceArea` (quartierId), utilisées par la recherche d'agences et la recommandation de mandat (03).

## Modèle de données
```prisma
enum InvitationStatus { PENDING ACCEPTED DECLINED EXPIRED REVOKED }
enum MemberStatus { ACTIVE DISABLED }
enum ReviewSourceType { LEASE BOOKING SALE VISIT }

model Organization {
  // + champs
  legalName     String?
  rccm          String?
  niu           String?
  email         String?
  logoKey       String?
  description   String?
  openingHours  Json?
  socialLinks   Json?
  createdById   String?
  approvedAt    DateTime?
  approvedBy    String?
  suspendedReason String?
}

model OrganizationMember {
  // + champs
  status    MemberStatus @default(ACTIVE)
  invitedBy String?
  joinedAt  DateTime     @default(now())
}

model OrganizationInvitation {
  id             String           @id @default(cuid())
  organizationId String
  role           OrgMemberRole
  phone          String?
  email          String?
  tokenHash      String           @unique
  status         InvitationStatus @default(PENDING)
  invitedById    String
  expiresAt      DateTime
  acceptedById   String?
  createdAt      DateTime         @default(now())
}

model OrganizationServiceArea {
  organizationId String
  quartierId     String
  @@id([organizationId, quartierId])
}

model OrganizationReview {
  // remplace authorName libre
  authorId   String
  sourceType ReviewSourceType
  sourceId   String
  reply      String?
  repliedAt  DateTime?
  status     String  // PUBLISHED | HIDDEN | FLAGGED
  @@unique([sourceType, sourceId, authorId])
}
```

## Endpoints
| Méthode | Route | Rôle | Description |
|---|---|---|---|
| POST | `organizations` | auth | Crée une agence (PENDING) |
| PATCH | `organizations/:id` | ADMIN org | Modifie le profil et la vitrine |
| POST | `organizations/:id/logo` | ADMIN org | Upload du logo (R2) |
| PUT | `organizations/:id/service-areas` | ADMIN org | `{ quartierIds[] }` |
| GET | `organizations/:id/members` | membre | Liste des membres |
| PATCH | `organizations/:id/members/:userId` | ADMIN org | `{ role?, status? }` |
| DELETE | `organizations/:id/members/:userId` | ADMIN org | Retire un membre |
| POST | `organizations/:id/invitations` | ADMIN org | `{ phone? , email?, role }` |
| GET | `organizations/:id/invitations` | ADMIN org | Invitations en cours |
| DELETE | `organizations/:id/invitations/:invId` | ADMIN org | Révoque |
| GET | `invitations/:token` | public | Aperçu (agence, rôle) |
| POST | `invitations/:token/accept` | auth | Accepte |
| POST | `invitations/:token/decline` | auth | Refuse |
| POST | `organizations/:id/leave` | membre | Quitter l'agence |
| GET | `organizations/:id/reviews` | public | **Modifié** : paginé |
| POST | `organizations/:id/reviews` | auth éligible | `{ sourceType, sourceId, rating, comment }` |
| POST | `reviews/:id/reply` | ADMIN org | Réponse publique |
| POST | `reviews/:id/flag` | ADMIN org | Signalement à la modération |
| GET | `users/me/review-eligibility` | auth | Interactions pouvant être notées |

## Écrans
- **Web, agence** :
  - `/agent/settings/agency` : profil, logo, zones, horaires ;
  - `/agent/settings/team` : membres, invitations, rôles ;
  - `/agent/reviews` : avis et réponses.
- **Web, onboarding** : `onboarding/role` → « Je crée mon agence » (formulaire RCCM et NIU) ou « Je rejoins une agence » (saisie du code d'invitation). Plus d'affiliation automatique.
- **Web, public** : `/invitations/[token]` pour accepter.
- **Mobile** :
  - fiche agence : avis paginés, CTA « Laisser un avis » si éligible ;
  - `profile/reviews` : avis à donner, après chaque interaction terminée.
- **Admin** : voir 12 (file d'affiliation, suspension).

## Critères d'acceptation
- Une agence PENDING ne peut pas publier : 403 `ORG_NOT_APPROVED`.
- Retirer le dernier ADMIN renvoie 409 `LAST_ADMIN`.
- Une invitation expirée ou déjà utilisée renvoie 410.
- Retirer un agent remet ses mandats à `assignedAgentId = null` et notifie le gérant.
- Un avis sans interaction éligible renvoie 403 `REVIEW_NOT_ELIGIBLE`. Un second avis sur la même interaction renvoie 409.
- `rating` de l'org égale la moyenne des avis PUBLISHED (test).

## Priorité
- **P0** : création d'agence et invitations (en remplacement de l'affiliation automatique).
- **P1** : gestion des membres, avis réels, vitrine et logo.
- **P2** : zones d'intervention, réponses aux avis, `dealSuccessPercent` calculé.
