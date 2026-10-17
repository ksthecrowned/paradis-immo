# 02 — Organisations, agences et équipes

## Objectif et rôles
Permettre à une agence de s'inscrire, d'être affiliée, de gérer son équipe et sa vitrine publique. Le propriétaire particulier dispose de son organisation de type OWNER.
- Rôles : `MANAGER`, qui administre l'agence ; `AGENT` ; `OWNER` ; `PLATFORM_ADMIN`, qui valide l'affiliation.

## Audit initial — état local à revalider
- `Organization` contient `type` (PLATFORM, AGENCY, OWNER), `affiliationStatus` (PENDING, APPROVED, SUSPENDED), `verified`, et des champs vitrine (shortName, tagline, logoColor, foundedYear, `rating`, `reviewCount`, `dealSuccessPercent`).
- Une agence approuvée n’entre dans l’annuaire public qu’après enregistrement d’un `shortName` non vide. Son administrateur doit renseigner la vitrine avant d’accéder au portail de gestion ; l’API demeure l’autorité de l’accès à son profil.
- Aucun endpoint de création ou de modification d'organisation. Aucune invitation, aucune gestion des membres.
- Le choix du rôle dans le parcours web de gestion (`auth/web/role`) crée l'org implicitement. Pour l'agent, il rattache au mécanisme `ensureAgentMembership` (faille, voir 01). Ce parcours est réservé aux propriétaires et membres d'agence, pas aux clients finaux.
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
9. En tant qu'ADMIN d'agence, je gère le **portefeuille clients** de mon agence : recherche d'un compte Paradis Immo par numéro (résultat minimal), ajout CRM avec notification d'information, ou création d'un contact externe sans compte. Un client n'est pas un membre de l'agence.
10. En tant qu'AGENT, je consulte et sélectionne un client de mon agence lors de la création ou modification autorisée d'un bien ; je ne crée, n'édite ni n'archive les fiches CRM.
11. En tant que contact externe devenu utilisateur, je confirme explicitement (OTP + décision) le rattachement à la fiche CRM de l'agence ; le refus ne fusionne rien et l'agence ne reçoit qu'un état générique.

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
  - ADMIN : tout dans l'org, dont équipe, vitrine, finances, attribution des mandats, **portefeuille clients CRM** et **dépôt/remplacement des mandats papier** (voir 03 et ADR-0001).
  - AGENT : biens et mandats assignés seulement, sans accès aux finances globales de l'agence ; **consultation/sélection** des clients de l'agence pour rattacher un bien, sans mutation CRM.
- **Clients d'agence (CRM)** — distinct des membres
  - Chaque fiche `AgencyClient` appartient à une seule agence. Le même compte utilisateur peut être client de plusieurs agences ; aucune fuite CRM, biens ou mandats entre agences.
  - Contact externe : nom, téléphone normalisé E.164, e-mail facultatif, notes internes selon politique de données ; **pas** de ligne `User` artificielle.
  - Compte lié : `userId` renseigné après lookup confirmé ou rattachement explicite ; les champs vérifiés du compte ne sont pas écrasés par la saisie agence.
  - Statuts de liaison (ou demande dédiée) : `UNLINKED` | `CLAIM_PENDING` | `LINKED` | `CLAIM_DECLINED` — ne jamais déduire `LINKED` du seul numéro saisi par l'agence.
  - Ajout d'un compte existant au CRM : résultat de recherche minimal (identité suffisante pour confirmation) ; **notification d'information** au compte ; aucun accès aux biens du compte ; ne vaut pas acceptation de mandat.
  - Rattachement contact → compte : correspondance exacte du numéro vérifié, OTP, confirmation explicite ; en cas de conflit/doublon/numéro inaccessible → parcours admin plateforme, pas de fusion automatique.
  - **Procédure de rattachement** : après vérification OTP du numéro déjà enregistré sur la fiche externe, le propriétaire connecté voit le nom de l'agence et confirme explicitement le rattachement. Aucun bien, mandat ou document n'est exposé avant confirmation. Le refus laisse la fiche CRM et ses liens inchangés ; l'agence reçoit uniquement un état générique.
  - Si le numéro de la fiche est différent, changé, inaccessible ou partagé, ne pas rapprocher par nom ou similarité. Ouvrir une demande de vérification assistée à la plateforme ; l'admin plateforme compare manuellement l'identité du compte avec les informations de la fiche et examine un justificatif d'identité obtenu par un canal privé contrôlé. Si les noms sont ambigus ou incohérents, demander une preuve complémentaire de continuité (par exemple contrôle de l'ancien numéro s'il redevient accessible ou justificatif de relation détenu par le propriétaire) ; une déclaration de l'agence seule ne suffit pas. Si la preuve est insuffisante ou contradictoire, refuser le rattachement et conserver les identités séparées. Limiter l'accès au justificatif aux réviseurs autorisés, tracer la consultation et ne conserver une copie que si une durée/finalité de conservation a été validée ; sinon conserver uniquement la décision et ses métadonnées.
  - Après contrôle, rattacher atomiquement le même `AgencyClient` au compte confirmé, conserver l'historique CRM autorisé et les liens vers les biens/mandats ; ne pas écraser les informations vérifiées du compte avec les données de l'agence. Enregistrer demandeur, décideur, horodatages et base de la décision dans l'audit.
  - Le rattachement rend au propriétaire visibles les biens/dossiers associés selon leurs autorisations, mais ne vaut ni preuve définitive de propriété, ni acceptation d'un mandat, ni activation de celui-ci. Une relation client peut exister avec plusieurs agences ; une fiche ou un compte ne peut pas être fusionné ou déplacé entre agences sans procédure auditée.
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
- **Portail web de gestion** : `/invitations/[token]` est un flux ponctuel d'acceptation d'invitation d'équipe, pas un portail client. Après acceptation, le membre accède au portail selon son rôle.
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
- Un AGENT reçoit 403 sur création/édition/archivage CRM ; un membre d'une autre agence ne lit ni ne mute les clients CRM.
- Créer un contact externe ne crée aucun `User` ; lier un compte existant envoie une notification d'information et n'accorde aucun droit sur les biens du compte.
- Le rattachement contact→compte exige confirmation explicite après OTP ; un refus laisse la fiche CRM inchangée côté fusion.
- Un numéro différent ou inaccessible ne déclenche aucune fusion automatique ; le rattachement assisté est décidé par la plateforme, audité et refusé si les éléments ne suffisent pas.

## Priorité
- **P0** : création d'agence et invitations (en remplacement de l'affiliation automatique).
- **P1** : gestion des membres, avis réels, vitrine et logo.
- **P2** : zones d'intervention, réponses aux avis, `dealSuccessPercent` calculé.

## Delta d'implémentation
| ID | Priorité | Delta | État |
|---|---|---|---|
| 02.1 | P0 | Remplacer la création implicite d'organisation par la création/affiliation explicite, avec contrôle d'approbation. | **Présent localement.** Demandes d'organisation, décisions d'approbation et invitation/adhésion explicites sont implémentées. Tester les transitions et les notifications sur les parcours web/mobile avant lancement. |
| 02.2 | P0 | Sécuriser invitations, rôles, retrait/désactivation des membres et réassignation des mandats ; interdire toute adhésion implicite. | **Partiel.** Invitations à cible unique avec jeton haché, expiration, révocation et contrôle de correspondance ; gestion des membres, protection du dernier administrateur et réaffectation des mandats existent. Les accès portefeuille/mandat/KYC et la vitrine filtrent désormais les appartenances ACTIVE ; auditer les autres routes et l'acceptation concurrente/à usage unique. |
| 02.3 | P1 | Terminer la vitrine, avis éligibles/modérés et recalcul des indicateurs. | **Présent localement.** Vitrine, avis liés à une interaction éligible, filtre automatique, réponses et recalcul des métriques sont implémentés. La modération humaine et la cohérence des métriques restent à valider selon les règles produit. |
| 02.4 | P2 | Compléter zones d'intervention, réponses/signalements d'avis et taux de succès calculé. | **Partiel.** Zones d'intervention, réponses et calcul du taux de succès sont présents ; compléter/vérifier le signalement et le traitement de modération des avis. |
| 02.5 | P0 | Portefeuille clients d'agence (CRM), isolation multi-agence, permissions ADMIN/AGENT et rattachement contact→compte. | **À faire.** Contrat figé dans cette spec et ADR-0001 ; implémentation lots 1–2 du plan agency-clients. |

État établi par inspection du code local ; la couverture automatisée et les contrôles d'accès négatifs doivent être confirmés avant de clôturer les critères de lancement.
