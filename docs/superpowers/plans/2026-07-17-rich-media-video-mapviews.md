# Rich Media V1 (Video + mapViews) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make property videos uploadable and playable end-to-end, remove Street View, and keep tour360 as a “coming soon” flag only.

**Architecture:** Keep `PropertyMedia` PHOTO|VIDEO as-is. Enforce a 20 Mo video size limit in the Nest upload path. Filter invalid `mapViews` (including legacy `streetView`) in `toPublic`. Upgrade owner web media UI (dropzone + separate photo/video CTAs + typed tiles). Teach `MediaGallery` and the mobile public gallery to render VIDEO. Delete the Street View route/UI.

**Tech Stack:** NestJS + Prisma + R2, Next.js 16 (web owner), Expo Router (mobile), Jest/supertest for API.

**Spec:** `docs/superpowers/specs/2026-07-17-rich-media-video-mapviews-design.md`

## Global Constraints

- Video max size: **20 Mo** (`20 * 1024 * 1024` bytes).
- Video formats: **`video/mp4`**, **`video/quicktime`** only (existing R2 whitelist).
- Photo formats unchanged (`image/jpeg|png|webp|heic`).
- `MapViewId` after change: **`neighborhood` | `tour360`** only — **no `streetView`**.
- `tour360`: keep in enum/UI as **“Bientôt”**; no immersive player in V1.
- No thumbnail/duration server fields in V1.
- No drag-reorder, no upload progress bars beyond existing per-file status list.
- Copy empty state (owner): « Ajoutez des photos ou une vidéo pour valoriser le bien ».

## File map

| File | Responsibility |
|---|---|
| `apps/api/prisma/schema.prisma` | Remove `streetView` from `MapViewId` |
| `apps/api/prisma/migrations/<ts>_drop_street_view_map_view/migration.sql` | Alter enum + scrub JSON |
| `apps/api/src/properties/properties.service.ts` | Filter mapViews to known ids |
| `apps/api/src/media/media.controller.ts` | Raise multipart limit to 20 Mo |
| `apps/api/src/media/media.service.ts` | Reject VIDEO > 20 Mo with `FILE_TOO_LARGE` |
| `apps/api/src/media/media.spec.ts` | Tests for video size + VIDEO upload |
| `apps/web/lib/owner/properties.ts` | Drop `streetView` from `MapViewId` / `MAP_VIEWS` |
| `apps/web/components/detail/MediaGallery.tsx` | Render PHOTO vs VIDEO |
| `apps/web/components/owner/property-media-uploader.tsx` | Option A UI + video accept + 20 Mo |
| `apps/web/app/owner/properties/owner-property-form.tsx` | Médias tab Option A + mapViews chips |
| `apps/web/app/owner/properties/[id]/owner-property-detail-view.tsx` | Pass `type` to gallery; badge tour360 |
| `apps/mobile/types/property.ts` | Drop `streetView`; add typed media list |
| `apps/mobile/lib/map-property.ts` | Map media type from API |
| `apps/mobile/lib/property-map-views.ts` | Remove streetView path |
| `apps/mobile/components/property/detail/constants.ts` | Remove streetView meta |
| `apps/mobile/components/property/detail/PropertyDetailGalleryPreview.tsx` | Video tile + playback |
| `apps/mobile/app/_layout.tsx` | Unregister street-view screen |
| `apps/mobile/app/property/[id]/street-view.tsx` | **Delete** |
| `apps/mobile/lib/mock-properties.ts` | Remove streetView from mocks |

---

### Task 1: API — drop `streetView` + filter mapViews

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (`enum MapViewId`)
- Create: `apps/api/prisma/migrations/20260717060000_drop_street_view_map_view/migration.sql`
- Modify: `apps/api/src/properties/properties.service.ts` (`jsonStringArray` usage for mapViews → dedicated filter)
- Test: add assertions in an existing properties unit/e2e if present; otherwise extend a small unit test on the filter helper (inline private → extract `filterMapViews`)

**Interfaces:**
- Produces: `filterMapViews(value: unknown): string[]` returning only `'neighborhood' | 'tour360'`
- Consumes: Prisma `MapViewId` without `streetView`

- [ ] **Step 1: Write failing filter unit test**

Add to `apps/api/src/properties/map-views.util.ts` (new) and `apps/api/src/properties/map-views.util.spec.ts`:

```ts
// map-views.util.ts
export const KNOWN_MAP_VIEWS = ['neighborhood', 'tour360'] as const;
export type KnownMapView = (typeof KNOWN_MAP_VIEWS)[number];

export function filterMapViews(value: unknown): KnownMapView[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(KNOWN_MAP_VIEWS);
  const out: KnownMapView[] = [];
  for (const item of value) {
    if (typeof item === 'string' && allowed.has(item)) {
      out.push(item as KnownMapView);
    }
  }
  return out;
}
```

```ts
// map-views.util.spec.ts
import { filterMapViews } from './map-views.util';

describe('filterMapViews', () => {
  it('drops streetView and unknown values', () => {
    expect(
      filterMapViews(['neighborhood', 'streetView', 'tour360', 'nope']),
    ).toEqual(['neighborhood', 'tour360']);
  });

  it('returns [] for non-arrays', () => {
    expect(filterMapViews(null)).toEqual([]);
    expect(filterMapViews('neighborhood')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module missing)**

Run: `cd apps/api && bunx jest src/properties/map-views.util.spec.ts -v`  
Expected: FAIL cannot find module / test fails

- [ ] **Step 3: Implement util + wire `toPublic`**

In `properties.service.ts` replace:

```ts
mapViews: this.jsonStringArray(p.mapViews),
```

with:

```ts
mapViews: filterMapViews(p.mapViews),
```

Import `filterMapViews` from `./map-views.util`.

- [ ] **Step 4: Update Prisma enum + migration**

In `schema.prisma`:

```prisma
enum MapViewId {
  neighborhood
  tour360
}
```

Migration SQL (Postgres enum alter — recreate safely):

```sql
-- Scrub legacy JSON values before enum shrink
UPDATE "Property"
SET "mapViews" = COALESCE(
  (
    SELECT jsonb_agg(elem)
    FROM jsonb_array_elements_text(COALESCE("mapViews"::jsonb, '[]'::jsonb)) AS elem
    WHERE elem IN ('neighborhood', 'tour360')
  ),
  '[]'::jsonb
)
WHERE "mapViews" IS NOT NULL;

-- Rebuild enum without streetView
CREATE TYPE "MapViewId_new" AS ENUM ('neighborhood', 'tour360');
DROP TYPE "MapViewId";
ALTER TYPE "MapViewId_new" RENAME TO "MapViewId";
```

Note: `mapViews` is stored as `Json?`, not as `MapViewId[]` — the enum is used by Nest/Prisma client validation for DTOs. Confirm in schema that `mapViews` remains `Json?`. The DROP TYPE is still required so Prisma Client regenerates without `streetView`.

If `MapViewId` is unused as a column type (only Json), the migration can be:

```sql
-- No column cast needed; rebuild enum for Prisma Client
CREATE TYPE "MapViewId_new" AS ENUM ('neighborhood', 'tour360');
DROP TYPE "MapViewId";
ALTER TYPE "MapViewId_new" RENAME TO "MapViewId";
```

Plus the JSON scrub UPDATE above.

- [ ] **Step 5: Generate client + run tests**

```bash
cd apps/api && bunx prisma generate && bunx prisma migrate deploy
cd apps/api && bunx jest src/properties/map-views.util.spec.ts -v
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma apps/api/src/properties/map-views.util.ts apps/api/src/properties/map-views.util.spec.ts apps/api/src/properties/properties.service.ts
git commit -m "feat(api): remove streetView map view and filter legacy values"
```

---

### Task 2: API — enforce 20 Mo video limit on upload

**Files:**
- Modify: `apps/api/src/media/media.controller.ts` (FileInterceptor `limits.fileSize` → `20 * 1024 * 1024`)
- Modify: `apps/api/src/media/media.service.ts` (`upload` + optionally `presign` docs)
- Modify: `apps/api/src/media/media.spec.ts`

**Interfaces:**
- Produces: `BadRequestException` `{ code: 'FILE_TOO_LARGE', message: '...' }` when VIDEO buffer > 20 Mo
- Consumes: `R2Service.resolveMediaType`

- [ ] **Step 1: Write failing test for oversized video**

In `media.spec.ts`, after existing upload tests, add (adapt auth header pattern already used in the file):

```ts
it('rejects VIDEO larger than 20 Mo', async () => {
  const big = Buffer.alloc(20 * 1024 * 1024 + 1, 0);
  const res = await request(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/media/upload`)
    .set('Authorization', `Bearer ${ownerAccessToken}`)
    .attach('file', big, { filename: 'big.mp4', contentType: 'video/mp4' });
  expect(res.status).toBe(400);
  expect(res.body.code ?? res.body.message).toBeTruthy();
});
```

Ensure `fakeR2.resolveMediaType` returns `'VIDEO'` for `video/mp4` (already in beforeAll). Stub `uploadPropertyFile` if not already stubbed for the multipart path.

- [ ] **Step 2: Run test — expect FAIL (currently 15 Mo interceptor may 413 first, or accept)**

Run: `cd apps/api && bunx jest src/media/media.spec.ts -t "rejects VIDEO larger than 20 Mo" -v`  
Expected: FAIL or wrong status (document actual; then fix)

- [ ] **Step 3: Implement limit**

In `media.controller.ts`:

```ts
FileInterceptor('file', {
  limits: { fileSize: 20 * 1024 * 1024 },
}),
```

In `media.service.ts` `upload`, after resolving `mediaType`:

```ts
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
if (mediaType === MediaType.VIDEO && file.buffer.length > MAX_VIDEO_BYTES) {
  throw new BadRequestException({
    code: 'FILE_TOO_LARGE',
    message: 'La vidéo ne doit pas dépasser 20 Mo.',
  });
}
```

- [ ] **Step 4: Add happy-path VIDEO upload test (small buffer)**

```ts
it('accepts a small VIDEO upload', async () => {
  fakeR2.uploadPropertyFile = jest.fn().mockResolvedValue({
    url: 'https://cdn.example.com/properties/x/vid.mp4',
    key: 'properties/x/vid.mp4',
  });
  const res = await request(app.getHttpServer())
    .post(`/api/v1/properties/${propertyId}/media/upload`)
    .set('Authorization', `Bearer ${ownerAccessToken}`)
    .attach('file', Buffer.from('fake-mp4'), {
      filename: 'clip.mp4',
      contentType: 'video/mp4',
    });
  expect(res.status).toBe(201);
  expect(res.body.type).toBe('VIDEO');
});
```

Wire `uploadPropertyFile` on the fake R2 object in `beforeAll` if missing.

- [ ] **Step 5: Run media tests — expect PASS**

Run: `cd apps/api && bunx jest src/media/media.spec.ts -v`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/media
git commit -m "feat(api): allow 20Mo video uploads and reject oversized videos"
```

---

### Task 3: Web — MediaGallery supports VIDEO

**Files:**
- Modify: `apps/web/components/detail/MediaGallery.tsx`

**Interfaces:**
- Consumes: `MediaGalleryItem` extended with optional `type?: 'PHOTO' | 'VIDEO' | string` (default PHOTO)
- Produces: grid tiles + lightbox that use `<video controls>` for VIDEO

- [ ] **Step 1: Extend item type**

```ts
export type MediaGalleryItem = {
  id: string;
  url: string;
  alt?: string;
  caption?: string;
  type?: 'PHOTO' | 'VIDEO' | string;
};
```

- [ ] **Step 2: Render tile + lightbox by type**

In the grid button content, replace unconditional `Image` with:

```tsx
{item.type === 'VIDEO' ? (
  <div className="absolute inset-0 flex items-center justify-center bg-black">
    <video
      src={item.url}
      className="h-full w-full object-cover"
      muted
      preload="metadata"
      playsInline
    />
    <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
      <Icon icon="mdi:play-circle" className="h-10 w-10 text-white" />
    </span>
  </div>
) : (
  <Image /* existing props */ />
)}
```

In lightbox body:

```tsx
{items[activeIdx].type === 'VIDEO' ? (
  <video
    src={items[activeIdx].url}
    controls
    autoPlay
    className="max-h-[90vh] max-w-[90vw] rounded-lg"
  />
) : (
  <Image /* existing */ />
)}
```

- [ ] **Step 3: Manual smoke** — open any page using MediaGallery with a photo; still works. (Automated UI test optional.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/detail/MediaGallery.tsx
git commit -m "feat(web): MediaGallery renders VIDEO tiles and lightbox player"
```

---

### Task 4: Web — PropertyMediaUploader Option A (photos + video)

**Files:**
- Modify: `apps/web/components/owner/property-media-uploader.tsx`
- Modify: `apps/web/components/forms/DropZone.tsx` only if needed (prefer composition without changing DropZone contract)

**Interfaces:**
- Consumes: `uploadMedia(propertyId, file, position)`, `MediaGallery` with `type`
- Produces: UI with dropzone + « Ajouter des photos » + « Ajouter une vidéo », 20 Mo video validation

- [ ] **Step 1: Add client validators**

```ts
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const VIDEO_TYPES = new Set(['video/mp4', 'video/quicktime']);

function isVideoFile(file: File): boolean {
  return VIDEO_TYPES.has(file.type);
}

function validateMediaFiles(files: File[]): { ok: File[]; error: string | null } {
  const ok: File[] = [];
  for (const f of files) {
    if (isVideoFile(f)) {
      if (f.size > MAX_VIDEO_BYTES) {
        return { ok: [], error: `« ${f.name} » dépasse 20 Mo.` };
      }
      ok.push(f);
      continue;
    }
    if (!f.type.startsWith('image/')) {
      return { ok: [], error: `« ${f.name} » : format non supporté.` };
    }
    ok.push(f);
  }
  return { ok, error: null };
}
```

- [ ] **Step 2: Rebuild UI layout**

Structure:

```tsx
<div className="space-y-4">
  <DropZone
    onFiles={(files) => void handleFiles(files)}
    accept="image/*,video/mp4,video/quicktime"
    maxSizeMb={20}
    multiple
    disabled={isUploading}
    title="Glissez photos ou vidéo ici"
    hint="JPG, PNG, WEBP, MP4, MOV — vidéo max 20 Mo"
  />
  <div className="flex flex-wrap gap-2">
    <button type="button" onClick={() => photoInputRef.current?.click()} ...>
      Ajouter des photos
    </button>
    <button type="button" onClick={() => videoInputRef.current?.click()} ...>
      Ajouter une vidéo
    </button>
  </div>
  <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={...} />
  <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime" className="hidden" onChange={...} />
  {/* errors + uploads list */}
  <MediaGallery
    items={media.map((m) => ({ id: m.id, url: m.url, type: m.type }))}
    emptyLabel="Ajoutez des photos ou une vidéo pour valoriser le bien."
  />
</div>
```

In `handleFiles`, run `validateMediaFiles` first; set `globalError` on failure.

- [ ] **Step 3: Manual check on `/owner/properties/[id]` Médias section** — photo still uploads; oversized fake file shows inline error.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/owner/property-media-uploader.tsx
git commit -m "feat(web): media uploader accepts video with separate CTAs"
```

---

### Task 5: Web — owner property form Médias tab + mapViews chips

**Files:**
- Modify: `apps/web/lib/owner/properties.ts` (`MapViewId`, `MAP_VIEWS`)
- Modify: `apps/web/app/owner/properties/owner-property-form.tsx` (Médias tab + FeatureChips mapViews)
- Modify: `apps/web/app/owner/properties/[id]/owner-property-detail-view.tsx` (gallery `type`, immersive section)

**Interfaces:**
- Consumes: Task 3 `MediaGalleryItem.type`, Task 4 patterns for pending files on create
- Produces: form without `streetView`; tour360 chip still selectable but labeled with « (bientôt) »

- [ ] **Step 1: Update shared constants**

```ts
export type MapViewId = 'neighborhood' | 'tour360';

export const MAP_VIEWS: { id: MapViewId; label: string; icon: string }[] = [
  { id: 'neighborhood', label: 'Quartier', icon: 'mdi:map-search-outline' },
  { id: 'tour360', label: 'Visite 360° (bientôt)', icon: 'mdi:rotate-3d-variant' },
];
```

- [ ] **Step 2: Rebuild Médias tab UI (create flow pending files)**

Mirror Option A: dropzone + two CTAs + typed pending tiles (object URL for video via `<video>`). Validate 20 Mo before queuing. Empty copy per spec.

When mapping pending/existing into `MediaGallery`, set `type: 'VIDEO'` for video files / API items.

- [ ] **Step 3: Detail view immersive section**

When rendering `property.mapViews`, skip unknown ids; for `tour360` show a small muted badge « Bientôt » next to the chip. Pass `type` into `MediaGallery` from `media` list.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/owner/properties.ts apps/web/app/owner/properties/owner-property-form.tsx apps/web/app/owner/properties/[id]/owner-property-detail-view.tsx
git commit -m "feat(web): owner media tab Option A and mapViews without streetView"
```

---

### Task 6: Mobile — remove Street View + typed media for video tiles

**Files:**
- Modify: `apps/mobile/types/property.ts`
- Modify: `apps/mobile/lib/map-property.ts`
- Modify: `apps/mobile/lib/property-map-views.ts`
- Modify: `apps/mobile/components/property/detail/constants.ts`
- Modify: `apps/mobile/components/property/detail/PropertyDetailGalleryPreview.tsx`
- Modify: `apps/mobile/app/property/[id]/index.tsx` (pass media/types into gallery)
- Modify: `apps/mobile/app/_layout.tsx`
- Modify: `apps/mobile/lib/mock-properties.ts`
- Delete: `apps/mobile/app/property/[id]/street-view.tsx`

**Interfaces:**
- Produces on `Property`:

```ts
export type PropertyMediaKind = 'PHOTO' | 'VIDEO';
export type PropertyMedia = { id?: string; url: string; type: PropertyMediaKind };

// Property fields:
mediaItems?: PropertyMedia[]; // preferred for gallery
// keep coverImage/images for backward compat derived from PHOTO+VIDEO urls
```

- `mapPublicProperty` builds `mediaItems` from `api.media` (`type` PHOTO|VIDEO), and still fills `coverImage` / `images` from ordered URLs for older call sites.
- `resolvePropertyMapViews` / `ALL_MAP_VIEWS` no longer include `streetView`.

- [ ] **Step 1: Update types + mapper + map view helpers**

```ts
// types/property.ts
export type PropertyMapView = 'neighborhood' | 'tour360';
```

```ts
// property-map-views.ts
export function propertyMapViewPath(propertyId: string, view: PropertyMapView): string {
  if (view === 'neighborhood') return `/property/${propertyId}/neighborhood`;
  return `/property/${propertyId}/tour-360`;
}
```

Remove `streetView` from `MAP_VIEW_META` and `ALL_MAP_VIEWS`.

In `map-property.ts`:

```ts
mediaItems: media.map((m) => ({
  id: m.id,
  url: m.url,
  type: m.type === 'VIDEO' ? 'VIDEO' : 'PHOTO',
})),
```

- [ ] **Step 2: Gallery preview video tile**

Extend `PropertyDetailGalleryPreview` to accept `mediaItems: PropertyMedia[]` (or derive from props). For a VIDEO slot in the 4-preview grid, render a dark cell with ▶; on press open a simple modal/`Video` from `expo-av` **or** navigate to a lightweight `/property/[id]/gallery` index that already exists — prefer inline `Video` from `expo-av` if already a dependency; otherwise use `react-native` `Pressable` + full-screen `Modal` with `Video`.

Check `apps/mobile/package.json` for `expo-av` / `expo-video`. If neither exists, add `expo-video` via `npx expo install expo-video` in this task (preferred for SDK 52+).

- [ ] **Step 3: Delete Street View screen + layout entry**

Remove `name="property/[id]/street-view"` from `_layout.tsx`. Delete `street-view.tsx`. Clean mocks.

- [ ] **Step 4: Typecheck / smoke**

```bash
cd apps/mobile && bunx tsc --noEmit
```

Expected: no errors referencing `streetView` or deleted route.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): play property videos and remove Street View"
```

---

### Task 7: End-to-end smoke checklist

**Files:** none (manual)

- [ ] **Step 1: API** — upload a ≤20 Mo mp4 via `POST /properties/:id/media/upload` → 201 `type:VIDEO`. Upload >20 Mo → 400 `FILE_TOO_LARGE`.
- [ ] **Step 2: Owner web add/edit** — dropzone + both CTAs; video tile shows ▶; detail page plays video; mapViews chips show Quartier + 360 (bientôt), no Street View.
- [ ] **Step 3: Mobile** — public property with VIDEO shows ▶ in gallery and plays; no Street View chip; tour360 still opens “bientôt” screen.
- [ ] **Step 4: Final commit** only if smoke fixes were needed; otherwise done.

---

## Spec coverage self-check

| Spec requirement | Task |
|---|---|
| VIDEO playable upload/read | 2, 3, 4, 5, 6 |
| 20 Mo limit client+API | 2, 4, 5 |
| Dropzone + separate CTAs + typed tiles | 4, 5 |
| Remove streetView enum/UI/routes | 1, 5, 6 |
| tour360 flag « bientôt » | 5, 6 |
| neighborhood remains | 1, 5, 6 |
| Filter legacy streetView JSON | 1 |
| MediaGallery type-aware | 3 |
| Tests upload VIDEO + oversized | 2 |
| Empty state copy | 4, 5 |

## Placeholder / consistency scan

- No TBD left.
- Limit consistently **20 Mo** everywhere (was 15 Mo interceptor — Task 2 raises it).
- `MapViewId` / `PropertyMapView` both `neighborhood | tour360` after Task 1/5/6.
- `MediaGalleryItem.type` and API `MediaItem.type` both use `'VIDEO' | 'PHOTO'`.
