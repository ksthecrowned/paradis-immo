# Documents locataire & contrats bail V1.1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owner/agent can upload/list/delete tenant ID docs and lease contract docs; tenant mobile can read them only.

**Architecture:** New Prisma models `TenantDocument` and `LeaseDocument`. Reuse R2 upload/delete patterns from `DocumentsService` / `R2Service`. Access via `AgencyAccessService` + lease ownership for tenants. Web extends tenant dossier + lease detail; mobile adds read-only sections.

**Tech Stack:** NestJS + Prisma + R2, Next.js owner/agent, Expo mobile, Jest.

**Spec:** `docs/superpowers/specs/2026-07-25-tenant-lease-documents-v1.1-design.md`

## Global Constraints

- Upload: **owner/agent only**; tenant: **GET only**.
- Formats: **PDF or image**, max **15 Mo** (`MAX_PHOTO_BYTES`).
- Types identité: `ID_CARD` | `PASSPORT` | `OTHER_ID`.
- Types bail: `SIGNED_LEASE` | `AMENDMENT` | `OTHER_LEASE`.
- Do **not** modify `PropertyDocument` / existing `DocumentType`.
- R2 keys: `tenants/{userId}/…`, `leases/{leaseId}/…`.

## File map

| File | Responsibility |
|------|----------------|
| `apps/api/prisma/schema.prisma` | Enums + models + User/Lease relations |
| `apps/api/prisma/migrations/<ts>_tenant_lease_documents/migration.sql` | Migration |
| `apps/api/src/media/r2.service.ts` | `uploadTenantFile` / `uploadLeaseFile` (or generic `uploadKeyedFile`) |
| `apps/api/src/tenants/tenant-documents.service.ts` | CRUD identité manager + `listMine` |
| `apps/api/src/tenants/tenant-documents.controller.ts` | `/tenants/:userId/documents` + `/me/documents` |
| `apps/api/src/leases/lease-documents.service.ts` | CRUD contrats |
| `apps/api/src/leases/lease-documents.controller.ts` | `/leases/:leaseId/documents` |
| `apps/api/src/tenants/tenant-documents.spec.ts` | Tests identité |
| `apps/api/src/leases/lease-documents.spec.ts` | Tests contrat |
| `apps/api/src/tenants/tenants.module.ts` / `leases.module.ts` / `media.module.ts` | Wire providers |
| `apps/web/lib/owner/tenant-documents.ts` | Client identité |
| `apps/web/lib/owner/lease-documents.ts` | Client contrat |
| `apps/web/components/tenants/tenant-detail-page.tsx` | Section identité |
| `apps/web/app/owner/leases/[id]/owner-lease-detail.tsx` | Section contrats |
| `apps/mobile/...` | Lecture seule cahier / bail |
| `TODOS.md` | D1/D2 ✅ |

---

### Task 1: Prisma schema + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260725070000_tenant_lease_documents/migration.sql`

**Interfaces:**
- Produces: `TenantDocument`, `LeaseDocument`, enums; `User.tenantDocuments`, `Lease.documents`

- [ ] **Step 1: Add enums + models** to schema (exact fields from spec). Add relations on `User` and `Lease`.

- [ ] **Step 2: Write migration SQL** creating enums + tables + indexes + FKs.

- [ ] **Step 3: Apply locally**

```bash
cd apps/api && bunx prisma migrate deploy
# or: bunx prisma migrate dev --name tenant_lease_documents
bunx prisma generate
```

Expected: client includes `prisma.tenantDocument` / `prisma.leaseDocument`.

- [ ] **Step 4: Commit** (if asked)

```bash
git add apps/api/prisma
git commit -m "$(cat <<'EOF'
feat(api): add TenantDocument and LeaseDocument models

EOF
)"
```

---

### Task 2: R2 helpers + TenantDocumentsService (TDD)

**Files:**
- Modify: `apps/api/src/media/r2.service.ts` — add:

```ts
async uploadBufferAtKey(key: string, body: Buffer, contentType: string): Promise<{ url: string; key: string }>
// or
async uploadTenantFile({ userId, filename, contentType, body })
async uploadLeaseFile({ leaseId, filename, contentType, body })
```

- Create: `apps/api/src/tenants/tenant-documents.service.ts`
- Create: `apps/api/src/tenants/tenant-documents.spec.ts`
- Modify: `apps/api/src/media/media.module.ts` — export `R2Service` if not already
- Modify: `apps/api/src/tenants/tenants.module.ts` — import `MediaModule`, provide service

**Interfaces:**
- `listForManagedTenant(managerId, tenantUserId)`
- `upload(managerId, tenantUserId, file, { type, name? })`
- `remove(managerId, tenantUserId, documentId)`
- `listMine(tenantUserId)`
- Access: same as `TenantsService.getManagedTenant` (bail en commun) for manager paths

- [ ] **Step 1: Failing tests** (mirror `tenants.spec.ts` fixtures)

```ts
it('owner uploads and lists ID_CARD for managed tenant', async () => { ... });
it('stranger cannot upload', async () => { ... });
it('tenant listMine returns only own docs', async () => { ... });
it('rejects non pdf/image', async () => { ... });
```

- [ ] **Step 2: Run — expect FAIL**

```bash
cd apps/api && bunx jest src/tenants/tenant-documents.spec.ts --runInBand
```

- [ ] **Step 3: Implement service** — copy validation from `DocumentsService.upload` (mime + size), set `uploadedBy = managerId`.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit** (if asked)

---

### Task 3: Tenant documents controller + `/me/documents`

**Files:**
- Create: `apps/api/src/tenants/tenant-documents.controller.ts`
- Modify: `apps/api/src/tenants/tenants.module.ts`

**Routes:**
- `GET/POST /tenants/:userId/documents` (+ `POST .../upload` or POST on collection — **match property docs**: use `POST .../upload` for consistency with `DocumentsController`)
- `DELETE /tenants/:userId/documents/:documentId`
- `GET /me/documents` on a small controller or same module with `@Controller('me/documents')`

Prefer parity with property docs:

```
GET    /tenants/:userId/documents
POST   /tenants/:userId/documents/upload
DELETE /tenants/:userId/documents/:documentId
GET    /me/documents
```

- [ ] **Step 1: Controllers + FileInterceptor** (same limits as property docs).

- [ ] **Step 2: Manual smoke** with owner token + tenant token.

- [ ] **Step 3: Commit** (if asked)

---

### Task 4: LeaseDocumentsService + controller (TDD)

**Files:**
- Create: `apps/api/src/leases/lease-documents.service.ts`
- Create: `apps/api/src/leases/lease-documents.controller.ts`
- Create: `apps/api/src/leases/lease-documents.spec.ts`
- Modify: `apps/api/src/leases/leases.module.ts` — import `MediaModule`, register controller/service

**Interfaces:**
- Manager: list/upload/remove if `assertCanOperateOnProperty`
- Tenant GET: if `lease.tenantId === userId` allow list; upload/remove forbidden

**Routes:**

```
GET    /leases/:leaseId/documents
POST   /leases/:leaseId/documents/upload
DELETE /leases/:leaseId/documents/:documentId
```

Note: `LeasesController` already owns `/leases` — register `LeaseDocumentsController` with `@Controller('leases/:leaseId/documents')` to avoid route clashes (same pattern as property documents).

- [ ] **Step 1: Failing tests** manager CRUD + tenant GET OK + tenant POST throws Forbidden.

- [ ] **Step 2: Implement + PASS**

```bash
cd apps/api && bunx jest src/leases/lease-documents.spec.ts --runInBand
```

- [ ] **Step 3: Commit** (if asked)

---

### Task 5: Web libs + fiche locataire (identité)

**Files:**
- Create: `apps/web/lib/owner/tenant-documents.ts`
- Modify: `apps/web/components/tenants/tenant-detail-page.tsx`

**Client:**

```ts
listTenantDocuments(userId)
uploadTenantDocument(userId, file, type, name?)
deleteTenantDocument(userId, documentId)
```

Labels FR: `ID_CARD` → « Carte d’identité », etc.

- [ ] **Step 1: Lib + UI section** — list, file input, type select, delete confirm, open `url` in new tab. Pattern: property documents block in `owner-property-detail-view.tsx` / form.

- [ ] **Step 2: Manual** on `/owner/tenants/[id]`.

- [ ] **Step 3: Commit** (if asked)

---

### Task 6: Web détail bail (contrats)

**Files:**
- Create: `apps/web/lib/owner/lease-documents.ts`
- Modify: `apps/web/app/owner/leases/[id]/owner-lease-detail.tsx`
- Agent: if agent has lease detail UI, mirror; else skip if only list exists

- [ ] **Step 1: Same upload/list/delete UX for lease docs.**

- [ ] **Step 2: Manual** on owner lease detail.

- [ ] **Step 3: Commit** (if asked)

---

### Task 7: Mobile lecture seule

**Files:**
- Create: `apps/mobile/lib/documents.ts` — `listMyDocuments()`, `listLeaseDocuments(leaseId)`
- Modify: `apps/mobile/app/portfolio/[propertyId]/rent.tsx` and/or `apps/mobile/app/leases/[id]/index.tsx`
- Optionally: `cahier-loyer` hub link

- [ ] **Step 1: Fetch + render list** with `Linking.openURL(doc.url)` ; empty copy « Aucun document pour l’instant ».

- [ ] **Step 2: Manual** as tenant with fixtures uploaded by owner.

- [ ] **Step 3: Commit** (if asked)

---

### Task 8: Docs status

**Files:**
- Modify: `docs/superpowers/specs/2026-07-25-tenant-lease-documents-v1.1-design.md` → statut **approuvé**
- Modify: `TODOS.md` — D1 ✅ D2 ✅ ; focus → V2 historique (plus tard) or next active item

- [ ] **Step 1: Update statuses**

- [ ] **Step 2: Commit** (if asked)

---

## Spec coverage

| Spec | Task |
|------|------|
| Prisma models | 1 |
| Tenant docs manager + `/me` | 2–3 |
| Lease docs manager + tenant GET | 4 |
| Web identité | 5 |
| Web contrats | 6 |
| Mobile read-only | 7 |
| PropertyDocument untouched | Global |

## Placeholder scan

None. Upload path suffix `/upload` chosen for parity with existing property documents API.
