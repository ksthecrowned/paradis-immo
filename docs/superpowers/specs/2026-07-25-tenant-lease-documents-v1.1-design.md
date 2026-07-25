# Documents locataire & contrats de bail (Phase Locative V1.1) — Design

> Statut : **approuvé** (25 juil. 2026). TODO `TODOS.md` — D1 / D2.  
> Plan : `docs/superpowers/plans/2026-07-25-tenant-lease-documents-v1.1.md`.  
> Décisions : upload **owner/agent seulement** ; locataire **lecture seule** ;  
> identité sur `User` ; contrat sur `Lease` ; **deux modèles** dédiés (pas d’extension de `PropertyDocument`).

## Objectif

Permettre à l’owner/agent de déposer et consulter les **pièces d’identité** d’un
locataire géré et les **contrats / avenants** d’un bail ; le locataire mobile
consulte ces fichiers en lecture seule depuis le cahier de loyer / fiche bail.

## Décisions produit

| Question | Décision |
|----------|----------|
| Qui upload | Owner / agent (web) uniquement |
| Qui lit (locataire) | Lecture seule mobile (`GET`) |
| Rattachement identité | `User` (`TenantDocument`) |
| Rattachement contrat | `Lease` (`LeaseDocument`) |
| Formats | PDF ou image, max **15 Mo** (aligné docs bien) |
| Stockage | R2 (même infra que `PropertyDocument`) |
| Hors scope | Upload locataire, e-sign, OCR, historique portable, docs vente |

## Modèle de données

```prisma
enum TenantDocumentType {
  ID_CARD
  PASSPORT
  OTHER_ID
}

enum LeaseDocumentType {
  SIGNED_LEASE
  AMENDMENT
  OTHER_LEASE
}

model TenantDocument {
  id         String             @id @default(uuid())
  userId     String
  user       User               @relation(fields: [userId], references: [id])
  type       TenantDocumentType
  url        String
  name       String
  uploadedBy String
  createdAt  DateTime           @default(now())

  @@index([userId])
}

model LeaseDocument {
  id         String            @id @default(uuid())
  leaseId    String
  lease      Lease             @relation(fields: [leaseId], references: [id])
  type       LeaseDocumentType
  url        String
  name       String
  uploadedBy String
  createdAt  DateTime          @default(now())

  @@index([leaseId])
}
```

Clés R2 suggérées : `tenants/{userId}/{uuid}-{filename}`,  
`leases/{leaseId}/{uuid}-{filename}`.

`PropertyDocument` / `DocumentType` (TITLE_DEED, PLAN, OTHER) **inchangés**.

## API

### Autorisation manager

Même périmètre que le dossier locataire / baux gérés :

- Identité : au moins un `Lease` du `userId` sur une propriété opérable.
- Bail : `agencyAccess.assertCanOperateOnProperty` sur `lease.propertyId`.

### Manager — identité

| Méthode | Path | Notes |
|---------|------|--------|
| `GET` | `/tenants/:userId/documents` | Liste |
| `POST` | `/tenants/:userId/documents` | Multipart : `file`, `type`, `name?` |
| `DELETE` | `/tenants/:userId/documents/:id` | + best-effort delete R2 |

### Manager — contrat

| Méthode | Path | Notes |
|---------|------|--------|
| `GET` | `/leases/:leaseId/documents` | Liste |
| `POST` | `/leases/:leaseId/documents` | Multipart : `file`, `type`, `name?` |
| `DELETE` | `/leases/:leaseId/documents/:id` | + best-effort delete R2 |

Réponse item :

```ts
{
  id: string;
  type: string;
  url: string;
  name: string;
  uploadedBy: string;
  createdAt: string;
  // TenantDocument: userId — LeaseDocument: leaseId
}
```

### Locataire (mobile)

| Méthode | Path | Notes |
|---------|------|--------|
| `GET` | `/me/documents` | Ses `TenantDocument` |
| `GET` | `/leases/:leaseId/documents` | Autorisé si `lease.tenantId === me` (lecture) |

Pas de POST/DELETE locataire en V1.1.

### Erreurs

| Code | Cas |
|------|-----|
| `TENANT_NOT_FOUND` / `LEASE_NOT_FOUND` | Hors scope ou inexistant |
| `DOCUMENT_NOT_FOUND` | Id inconnu |
| `UNSUPPORTED_CONTENT_TYPE` | Hors PDF/image |
| `FILE_TOO_LARGE` | > 15 Mo |
| `403` | Hors propriétés opérables |

## UI

### Web owner / agent

- **Fiche locataire** (`/owner/tenants/[id]`, agent miroir) : section **Pièces d’identité** — liste, upload, delete, ouvrir URL. Réutiliser le pattern docs bien.
- **Détail bail** : section **Contrats** — mêmes interactions pour `SIGNED_LEASE` / `AMENDMENT` / `OTHER_LEASE`.

### Mobile locataire

- **Cahier de loyer** / écran bail : blocs **Mes documents** + **Contrat** (liens ouverture). Empty state si vide. Aucun upload.

## Tests

- Upload/list/delete identité : owner OK ; stranger 403/404.
- Upload/list/delete contrat : manager du bien OK ; locataire GET OK, POST 403.
- Locataire `GET /me/documents` ne voit que ses fichiers.
- Rejet mime / taille.
- Manager sans bail en commun avec le user → pas d’accès docs identité.

## Ordre d’implémentation suggéré

1. Migration Prisma + relations `User` / `Lease`.
2. Service R2 helpers + `TenantDocumentsService` / `LeaseDocumentsService` (ou module `lease-docs` + endpoints tenants).
3. Controllers + guards + specs Jest.
4. Lib web + UI fiche locataire + détail bail.
5. Mobile lecture seule.
6. Mettre à jour `TODOS.md` (D1 / D2).
