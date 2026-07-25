# Dossier locataire & cahier de loyer (Phase Locative V1) — Design

> Statut : **approuvé** (25 juil. 2026). TODO `TODOS.md` — Phase Locative V1 (L0–L5).  
> Plan d’implémentation : `docs/superpowers/plans/2026-07-25-tenant-dossier-cahier-loyer-v1.md`.

## Objectif

Donner au owner/agent une vue **Locataires** (liste + fiche) dérivée des baux
gérés, avec suivi des paiements (MoMo / autres) et **validation manuelle** ;
et au locataire mobile un espace unifié **« Mon cahier de loyer »**.

## Décisions produit

| Question | Décision |
|----------|----------|
| Modèle locataire | Réutiliser `User` ; pas d’entité `Tenant` / `TenantProfile` en V1 |
| Qui voit quels locataires | Baux sur propriétés opérables (`AgencyAccessService`) — owner ou org mandatée |
| Date de création compte | Exposer `User.createdAt` (`accountCreatedAt`) sur liste + fiche |
| Paiements MoMo | Lecture via paiements existants (statuts provider) |
| Validation manuelle | Réutiliser `POST /payments/:id/validate` (cash / `PENDING_VALIDATION`) |
| Cahier mobile | Unifier / renommer l’existant (`portfolio/.../rent`, `leases/[id]`) — pas de nouveau domaine métier |
| Hors V1 | Docs identité, PDF contrat, historique portable, vente par paliers (V1.1 / V2 / V3 dans `TODOS.md`) |

## Architecture

```
User (tenant)
  └── Lease[] ──► Property (owner / mandate)
        └── RentSchedule[] ──► PaymentAllocation ← Payment
```

Surfaces :

| Qui | Quoi |
|-----|------|
| Web owner (+ agent miroir) | Nav **Locataires** → liste → fiche ; liens vers baux / validation paiement |
| Mobile locataire | Hub **Mon cahier de loyer** |
| API | `GET /tenants/managed`, `GET /tenants/:userId` ; paiements inchangés |

## API

### Autorisation

Même périmètre que `GET /leases/managed` :
`agencyAccess.listOperablePropertyIds(userId)`.

Un locataire n’est retourné que s’il a **au moins un** `Lease` sur une de ces
propriétés. Sinon `GET /tenants/:userId` → `404` (`TENANT_NOT_FOUND`).

### `GET /tenants/managed`

Liste dédoublonnée par `tenantId`.

```ts
type ManagedTenantListItem = {
  id: string;
  name: string | null;
  phone: string | null;
  accountCreatedAt: string; // User.createdAt ISO
  activeLeaseCount: number;
  leases: Array<{
    id: string;
    propertyId: string;
    propertyTitle: string;
    status: string;
    monthlyRent: string;
    currency: string;
  }>;
  paymentSummary: {
    pendingValidation: number; // Payment PENDING_VALIDATION liés aux baux
    overdueRentLines: number;  // RentSchedule PENDING avec dueDate < now
  };
};
```

Tri suggéré : `name` asc (nulls last), puis `accountCreatedAt` desc.

### `GET /tenants/:userId`

Même en-tête + :

- tous les baux gérés avec ce locataire (pas les baux hors scope) ;
- par bail actif : `nextDue` (`{ id, dueDate, amount, currency, status } | null`),
  `overdueCount` ;
- `recentPayments` : jusqu’à 20 paiements liés (allocation `RENT` /
  `metadata.rentScheduleId` sur échéances de ces baux), shape alignée sur
  `PublicPayment` (id, amount, currency, method, status, createdAt,
  validatedAt, allocations résumé).

### Paiements (existant — pas de nouveau modèle)

| Endpoint | Rôle V1 |
|----------|---------|
| `GET /payments/managed` | Liste globale owner/agent |
| `POST /payments/:id/validate` | Validation manuelle si `PENDING_VALIDATION` |
| Initiate + providers MoMo / cash | Côté locataire (mobile) inchangé |

Règle UI : bouton **Valider** seulement si `status === PENDING_VALIDATION`.
Paiements déjà `VALIDATED` (webhook MoMo) : lecture seule.

### Mobile locataire

Pas d’endpoint obligatoire nouveau. Réutiliser :

- `listMyLeases` / bail actif par bien ;
- schedule + `initiatePayment`.

Option V1 (si besoin UX) : un résumé cross-baux côté client à partir de
`listMyLeases` — pas de `GET /tenants/me`.

## UI web (owner / agent)

### Navigation

- Entrée **Locataires** à côté de **Baux**.
- Routes : `/owner/tenants`, `/owner/tenants/[id]`.
- Miroir agent : `/agent/tenants`, `/agent/tenants/[id]` si la nav agent expose
  déjà les baux (même API).

### Liste

Colonnes : nom, téléphone, compte créé le, baux actifs / biens, badges
« à valider » / « en retard » (depuis `paymentSummary`).

### Fiche

1. En-tête : nom, téléphone, `accountCreatedAt`.
2. Section **Baux** : cartes avec lien vers détail bail existant.
3. Section **Échéances** : prochaine + compteur retards par bail actif.
4. Section **Paiements récents** : méthode, statut, **Valider** si applicable.

La page **Paiements** globale reste ; V1 n’impose pas de filtre URL par
locataire (nice-to-have).

## UI mobile — Mon cahier de loyer

- Point d’entrée unique (hub Locations / Portfolio) libellé **Cahier de loyer**.
- **1 bail actif** : écran type `portfolio/[propertyId]/rent` actuel.
- **Plusieurs baux** : liste → hub par bien.
- Alignement copy uniquement ; pas de refonte visuelle lourde.

## Flux validation (rappel)

```
Locataire initie (MoMo | cash)
  → Payment PENDING_VALIDATION (ou VALIDATED via webhook MoMo)
Owner/agent voit (liste paiements | fiche locataire)
  → si PENDING_VALIDATION : POST /payments/:id/validate
  → RentSchedule → PAID si couverture complète + événement quittance existant
```

## Erreurs

| Code | Cas |
|------|-----|
| `TENANT_NOT_FOUND` | Aucun bail en commun / user inexistant dans le scope |
| `403` | Hors propriétés opérables (via agency access) |
| Erreurs validate | Comportement actuel de `PaymentsService.validateCashPayment` |

## Tests

- `tenants.managed` : owner voit uniquement locataires de ses biens ; agent org
  mandatée idem ; locataire sans lien → liste vide / détail 404.
- Agrégation : 2 baux même tenant → une seule ligne liste, 2 entrées `leases`.
- `accountCreatedAt` présent et égal à `User.createdAt`.
- `paymentSummary.overdueRentLines` / `pendingValidation` cohérents avec fixtures.
- Régression : `validateCashPayment` + `listManaged` paiements inchangés.
- Web : smoke routes liste/fiche (manuel ou e2e léger si déjà en place).

## Hors scope (explicit)

- Upload pièces d’identité / contrats PDF (V1.1).
- Demande / partage d’historique portable (V2).
- Échéancier vente par paliers (V3).
- Nouvelle table Prisma pour le locataire.

## Ordre d’implémentation suggéré

1. Module API `tenants` (`managed` + `:userId`) + specs Jest.
2. Lib web + pages owner (liste / fiche) + nav.
3. Miroir agent si applicable.
4. Branchement **Valider** sur la fiche (client existant `validatePayment`).
5. Mobile : hub / copy **Cahier de loyer**.
6. Mettre à jour `TODOS.md` (L0 ✅, L1–L5 au fil de l’eau).
