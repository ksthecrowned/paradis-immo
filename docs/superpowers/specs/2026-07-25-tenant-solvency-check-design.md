# Vérification de solvabilité locataire — Design

> Statut : validé (brainstorming 25 juil. 2026). Remplace l’ancienne idée
> « historique portable » (V2 locative).

## Objectif

Permettre à un **nouveau logeur** (owner/agent) de vérifier la solvabilité
d’un locataire déjà connu sur Paradis Immo, en lui demandant l’accès aux
**3 derniers loyers payés**. Le locataire **valide** explicitement ; l’accès
expire après **7 jours**.

Ce n’est **pas** un dossier portable ni un score : uniquement un snapshot
consenté des derniers paiements.

## Décisions produit

| Question | Décision |
|----------|----------|
| Qui initie | Owner/agent depuis la **fiche locataire** |
| Qui valide | Le locataire (accepter / refuser) |
| Contenu partagé | Date d’échéance, montant, statut payé, **délai** (jours après échéance) |
| Hors contenu | Nom du bien / quartier précédent, score, historique complet |
| Volume | 3 derniers loyers `PAID` (ou moins s’il y en a moins) |
| Durée d’accès | **7 jours** après acceptation, puis expiration auto |
| Modèle de consentement | Demande + réponse (pas de lien magique, pas d’opt-in permanent) |
| Snapshot | Figé à l’acceptation (pas de rafraîchissement live) |

## Parcours

1. Owner/agent ouvre la fiche locataire → « Demander la solvabilité ».
   Prérequis produit : le locataire est déjà dans **Mes locataires**
   (bail actif ou brouillon de l’org) — même accès que la fiche actuelle.
2. Prérequis données : au moins **1** échéance `RentSchedule` en `PAID`
   pour ce `tenantUserId` (tous baux de la plateforme). Sinon bouton
   désactivé + message.
3. Création d’un `SolvencyCheck` en `PENDING` + notification mobile au
   locataire.
4. Locataire voit qui demande (organisation) → Accepter / Refuser.
5. Sur **Accepter** : calcul du snapshot (top 3 `PAID` par `dueDate` desc),
   `status = GRANTED`, `expiresAt = now + 7 jours`.
6. Sur **Refuser** : `status = DENIED`.
7. Owner recharge la fiche → bloc Solvabilité selon l’état. Après
   `expiresAt`, lecture → `EXPIRED` (lazy à la lecture).

## Modèle de données

```prisma
enum SolvencyCheckStatus {
  PENDING
  GRANTED
  DENIED
  EXPIRED
}

model SolvencyCheck {
  id              String              @id @default(uuid())
  tenantUserId    String
  tenant          User                @relation(...)
  requesterUserId String
  requesterOrgId  String
  organization    Organization        @relation(...)
  status          SolvencyCheckStatus @default(PENDING)
  snapshot        Json?               // figé à l’acceptation
  respondedAt     DateTime?
  expiresAt       DateTime?
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  @@index([tenantUserId, status])
  @@index([requesterOrgId, tenantUserId])
}
```

### Forme du `snapshot`

```json
[
  {
    "dueDate": "2026-04-01",
    "paidAt": "2026-04-03",
    "amount": 150000,
    "currency": "XAF",
    "daysLate": 2
  }
]
```

- Source : `RentSchedule` avec `status = PAID`, baux où `lease.tenantId = tenantUserId`.
- `paidAt` : date du paiement validé lié (allocation / payment `VALIDATED`) ;
  si indisponible, fallback `updatedAt` du schedule PAID (à documenter en impl).
- `daysLate = max(0, calendarDays(paidAt − dueDate))`.

### Règles d’unicité

- Au plus **un** `PENDING` par couple `(requesterOrgId, tenantUserId)`.
- Une nouvelle demande est autorisée si le précédent est `GRANTED` /
  `DENIED` / `EXPIRED` (pas de spam tant qu’un PENDING est ouvert → 409).

## API

### Owner / agent (auth + droit « gère ce locataire »)

- `POST /api/v1/tenants/:userId/solvency-checks`  
  → `{ id, status: PENDING, ... }`  
  Erreurs : `NO_PAID_RENTS` (400), `PENDING_EXISTS` (409), `FORBIDDEN` (403).

- `GET /api/v1/tenants/:userId/solvency-checks/latest`  
  → dernier check de **cette org** pour ce locataire ; si `GRANTED` et
  `expiresAt < now` → passer en `EXPIRED` avant réponse ; **ne pas**
  renvoyer `snapshot` si non `GRANTED` (ou si expiré).

### Locataire (auth = lui-même)

- `GET /api/v1/me/solvency-checks` — liste (PENDING en tête).
- `POST /api/v1/me/solvency-checks/:id/respond` body `{ accept: boolean }`  
  → met à jour statut + snapshot si accept.

## Clients

### Web owner/agent — fiche locataire

Bloc **Solvabilité** :

| État | UI |
|------|-----|
| Aucun / EXPIRED / DENIED | Bouton « Demander la solvabilité » |
| PENDING | « En attente de la réponse du locataire » |
| GRANTED (valide) | Tableau des 3 lignes + « Expire le … » |
| 0 paiement PAID | Bouton désactivé + texte d’aide |

### Mobile locataire

- Entrée depuis **Mon cahier de loyer** (badge si PENDING).
- Écran demande : nom de l’organisation + texte d’explication + Accepter / Refuser.
- Pas d’affichage du détail des montants côté locataire avant accept
  (il connaît déjà son cahier) ; après accept, confirmation simple.

### Notifications

- À la création : notif locataire `SOLVENCY_CHECK_REQUESTED`.
- V1 : pas obligatoire de notif owner sur réponse (refresh fiche suffit).

## Droits

- Demande / lecture owner : même garde-fou que `GET /tenants/:userId`
  (locataire géré via bail de l’org).
- Réponse : uniquement `tenantUserId === currentUser`.

## Hors scope

- Historique portable riche / consentement granulaires multi-périodes.
- Nom du bien précédent, score de régularité.
- Lien magique / SMS one-shot.
- Solvabilité acheteur / paliers vente (V3).
- Job cron d’expiration (lazy à la lecture suffit pour V2).

## Tests (API)

- Demande OK → PENDING + notif émise (mock events).
- Demande avec 0 `PAID` → 400.
- Second PENDING même org/tenant → 409.
- Accept → snapshot ≤ 3, `expiresAt` ≈ +7j, owner voit snapshot.
- Deny → owner ne voit pas snapshot.
- Après `expiresAt` → lecture latest marque EXPIRED, snapshot masqué.
- Locataire non concerné / org non gestionnaire → 403.

## Renommage roadmap

Dans `TODOS.md`, la phase « Locative V2 — historique portable » devient
**« Locative V2 — vérification de solvabilité »** (H0–H3 alignés sur ce
design).
