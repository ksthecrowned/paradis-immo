# Signalement d’annonce — Design

> Statut : validé via TODOS P1-8 (motifs figés). Reprise 25 juil. 2026.

## Objectif

Permettre à un visiteur de signaler une annonce publique (6 motifs +
description optionnelle) et à un admin de traiter la file.

## Décisions

| Question | Décision |
|----------|----------|
| Motifs | ALREADY_SOLD_OR_RENTED · FRAUDULENT · DUPLICATE · INCORRECT_INFO · INAPPROPRIATE · OTHER |
| Description | Optionnelle ; **requise** si motif = OTHER (max 1000 car.) |
| Identité | Auth optionnelle : `user:<id>` si JWT, sinon `device:<installId>` obligatoire |
| Dédup | Un signalement **OPEN** max par `(propertyId, reporterKey)` — sinon 409 |
| Admin | Liste + changement de statut (OPEN → REVIEWED / DISMISSED / ACTIONED) |
| Action auto | Aucune (l’admin utilise déjà la modération de statut bien) |

## Modèle

```prisma
enum PropertyReportReason {
  ALREADY_SOLD_OR_RENTED
  FRAUDULENT
  DUPLICATE
  INCORRECT_INFO
  INAPPROPRIATE
  OTHER
}

enum PropertyReportStatus {
  OPEN
  REVIEWED
  DISMISSED
  ACTIONED
}

model PropertyReport {
  id          String
  propertyId  String
  reporterKey String   // user:<id> | device:<installId>
  reason      PropertyReportReason
  description String?
  status      PropertyReportStatus @default(OPEN)
  adminNote   String?
  reviewedAt  DateTime?
  createdAt   DateTime
}
```

## API

- `POST /api/v1/properties/:id/reports` (public, OptionalAuth) → `{ id, status }`
- `GET /api/v1/admin/reports?status=&page=&pageSize=`
- `PATCH /api/v1/admin/reports/:id` body `{ status, adminNote? }`

## Clients

- Mobile : action « Signaler » → écran motifs + envoi
- Admin web : page `/admin/reports` (file OPEN + actions)

## Hors scope

- Notification owner
- Auto-pause de l’annonce
