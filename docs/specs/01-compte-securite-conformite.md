# 01 — Compte, sécurité et conformité

## Objectif et rôles
Donner à chaque utilisateur le contrôle de son compte (sessions, téléphone, données, suppression) et fermer les failles d'accès relevées pendant l'audit.
Concerne tous les rôles. `PLATFORM_ADMIN` intervient pour la suspension et le KYC.

## État actuel (audit)
- `auth` : OTP mobile (5 tentatives max), magic link et Google pour le web, mot de passe et Google pour l'admin. Rotation du refresh token sur `POST auth/refresh`.
- Il n'existe ni `logout`, ni révocation, ni liste des sessions. Le refresh token reste valide jusqu'à expiration s'il est volé.
- Aucun rate limit propre à `otp/request`, en dehors du throttle global de 100 req/min. Risque de spam SMS (coût Infobip).
- `GET users/lookup?phone=` est accessible à tout utilisateur authentifié et renvoie le nom : énumération possible.
- `ensureAgentMembership` donne le rôle AGENT de l'org PLATFORM à n'importe quel appelant.
- Ni changement de téléphone ou d'e-mail, ni suppression de compte, ni export de données.
- Mobile : tokens dans AsyncStorage (voir 14).

## User stories
1. En tant qu'utilisateur, je me déconnecte et mon refresh token est révoqué côté serveur.
2. Je vois mes sessions actives (appareil, plateforme, dernière activité) et je peux en révoquer une, ou toutes sauf la session courante.
3. Je change de numéro de téléphone après vérification OTP sur le nouveau numéro.
4. Je change ou j'ajoute mon e-mail, avec vérification par magic link.
5. Je demande la suppression de mon compte. Elle est bloquée tant que j'ai un bail ACTIVE, un séjour à venir, une vente ACTIVE ou un solde dû.
6. Je télécharge l'export de mes données (JSON et PDF).
7. En tant que gestionnaire, je recherche un locataire par téléphone uniquement dans le cadre d'une création de bail, et je n'obtiens qu'un nom masqué.
8. En tant qu'admin, je suspends un compte : toutes ses sessions sont révoquées et il ne peut plus se connecter.
9. En tant que propriétaire ou agence, je soumets une pièce d'identité ou un RCCM pour obtenir le badge « vérifié » (KYC).

## Règles métier
- **Logout** : révoque le `RefreshToken` présenté. `logout-all` révoque tous les tokens du user.
- **Sessions**
  - `RefreshToken` stocke `deviceId`, `deviceName`, `platform` (`IOS`, `ANDROID`, `WEB`, `ADMIN`), `ipAddress`, `userAgent` et `lastUsedAt`.
  - Toute rotation conserve le `deviceId` et le `familyId`.
  - La réutilisation d'un refresh token déjà révoqué (rejeu) révoque toute la famille de cet appareil et journalise un événement de sécurité (12, audit log).
- **OTP**
  - Au plus 3 demandes par numéro sur 15 minutes et 10 par IP par heure.
  - Délai de 60 s entre deux envois.
  - Après 5 échecs, le numéro est bloqué 30 minutes.
- **Changement de téléphone**
  - Le nouveau numéro ne doit pas appartenir à un autre compte du même pays.
  - L'ancien numéro reste en historique (`UserPhoneHistory`) pour l'audit.
  - Les notifications SMS et WhatsApp utilisent immédiatement le nouveau numéro, et l'ancien reçoit un SMS d'information.
- **Lookup**
  - Réservé aux membres OWNER, ADMIN ou AGENT d'une org (`OrgContextGuard`), limité à 20 appels par heure et par user.
  - Réponse : `{ exists, userId, displayName: "Jean M." }`, sans e-mail ni avatar.
- **Suppression**
  - Soft delete (`deletedAt`) puis anonymisation à J+30 : nom, téléphone, e-mail, avatar et tokens push.
  - Les données comptables (paiements, reçus, baux) sont conservées 10 ans, rattachées à un pseudonyme.
  - Annulation possible pendant 30 jours en se reconnectant.
- **Suspension** : `User.status = SUSPENDED`. `AppAuthGuard` rejette avec `ACCOUNT_SUSPENDED`. Tous les refresh tokens sont révoqués.
- **Rôle AGENT** : on ne devient plus jamais membre d'une org implicitement. Seuls l'invitation (02) ou la création d'org l'accordent. `ensureAgentMembership` est supprimé.
- **KYC**
  - Documents : CNI, passeport ou RCCM + NIU pour une agence.
  - Statuts : `NONE`, `PENDING`, `VERIFIED`, `REJECTED` (avec motif).
  - Seul l'admin valide. `Organization.verified` découle du KYC de l'org.
  - Les fichiers KYC sont privés : URL signée de 5 minutes, accessible au seul propriétaire du dossier et à l'admin.
- **Consentements** : on horodate l'acceptation des CGU et de la politique de confidentialité (avec leur version), ainsi que l'opt-in marketing. Une nouvelle version des CGU impose une ré-acceptation au prochain lancement.

## Modèle de données
```prisma
enum UserStatus { ACTIVE SUSPENDED DELETED }
enum KycStatus { NONE PENDING VERIFIED REJECTED }
enum DevicePlatform { IOS ANDROID WEB ADMIN }

model User {
  // + champs
  status          UserStatus @default(ACTIVE)
  suspendedAt     DateTime?
  suspendedReason String?
  deletedAt       DateTime?
  kycStatus       KycStatus  @default(NONE)
  termsVersion    String?
  termsAcceptedAt DateTime?
  marketingOptIn  Boolean    @default(false)
}

model RefreshToken {
  // + champs
  familyId   String
  deviceId   String
  deviceName String?
  platform   DevicePlatform
  ipAddress  String?
  userAgent  String?
  lastUsedAt DateTime @default(now())
}

model UserPhoneHistory {
  id        String   @id @default(cuid())
  userId    String
  phone     String
  changedAt DateTime @default(now())
}

model KycSubmission {
  id              String    @id @default(cuid())
  userId          String?
  organizationId  String?
  documentType    String    // ID_CARD | PASSPORT | RCCM | NIU
  fileKey         String
  status          KycStatus @default(PENDING)
  reviewedBy      String?
  reviewedAt      DateTime?
  rejectionReason String?
  createdAt       DateTime  @default(now())
}

model DataExportRequest {
  id        String    @id @default(cuid())
  userId    String
  status    String    // PENDING | READY | EXPIRED
  fileKey   String?
  expiresAt DateTime?
  createdAt DateTime  @default(now())
}
```

## Endpoints
| Méthode | Route | Description |
|---|---|---|
| POST | `auth/logout` | `{ refreshToken }` : révoque le token |
| POST | `auth/logout-all` | Révoque toutes les sessions (option `includeCurrent`) |
| GET | `users/me/sessions` | Sessions actives |
| DELETE | `users/me/sessions/:id` | Révoque une session |
| POST | `users/me/phone/request` | `{ newPhone }` : envoie un OTP au nouveau numéro |
| POST | `users/me/phone/confirm` | `{ newPhone, code }` |
| POST | `users/me/email` | `{ email }` : magic link `VERIFY_EMAIL` |
| POST | `users/me/deletion` | Demande de suppression. 409 `ACCOUNT_HAS_ACTIVE_OBLIGATIONS` avec la liste des blocages |
| DELETE | `users/me/deletion` | Annule la demande |
| POST | `users/me/export` | Lance l'export |
| GET | `users/me/export/:id` | Statut et URL signée |
| POST | `users/me/consents` | `{ termsVersion, marketingOptIn }` |
| POST | `kyc/submissions` | Upload d'une pièce (user ou org) |
| GET | `kyc/submissions/mine` | Mes soumissions |
| GET | `users/lookup` | **Modifié** : guard org, rate limit, réponse masquée |

`auth/otp/verify`, `auth/web/*` et `auth/admin/*` acceptent en plus `{ deviceId, deviceName, platform }`.

## Écrans
- **Web, tous rôles** : `/settings/account` avec profil, téléphone, e-mail, sessions, export, suppression et KYC. Le menu `sidebar-user-menu` y donne accès et propose « Se déconnecter » (avec appel à `auth/logout`).
- **Mobile** :
  - `profile/security` : sessions, changement de numéro, déconnexion de tous les appareils ;
  - `profile/delete-account` : obligatoire pour la publication sur l'App Store (exigence 5.1.1(v)) et Google Play ;
  - `profile/data` : export et consentements.
- **Admin** : voir 12 (suspension, file KYC).

## Critères d'acceptation
- Après `auth/logout`, `auth/refresh` avec le même token renvoie 401.
- Rejouer un refresh token déjà roté révoque toutes les sessions de l'appareil.
- Une 4ᵉ demande d'OTP en moins de 15 minutes renvoie 429 `OTP_RATE_LIMITED` avec `retryAfter`.
- Un TENANT sans org qui appelle `users/lookup` reçoit 403.
- Aucun appel ne crée plus d'`OrganizationMember` implicitement (test de non-régression).
- La suppression est refusée tant qu'un bail est ACTIVE. Après 30 jours, le téléphone est remplacé par un hash et les paiements restent consultables par le gestionnaire.
- Un compte suspendu reçoit 403 `ACCOUNT_SUSPENDED` sur toute route authentifiée.

## Priorité
- **P0** : suppression d'`ensureAgentMembership`, logout et révocation, rate limit OTP, sécurisation du lookup, suspension, suppression de compte (exigence des stores).
- **P1** : sessions multi-appareils, changement de téléphone ou d'e-mail, KYC.
- **P2** : export de données, consentements versionnés.
