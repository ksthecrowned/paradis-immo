'use client';

import { useCallback, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { ApiError } from '@/lib/api';
import {
  listMedia,
  uploadMedia,
  type MediaItem,
} from '@/lib/owner/media';
import { DropZone } from '@/components/forms/DropZone';
import { MediaGallery, type MediaGalleryItem } from '@/components/detail/MediaGallery';

export interface PropertyMediaUploaderProps {
  propertyId: string;
  initialMedia: MediaItem[];
  onMediaChange: (items: MediaItem[]) => void;
}

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

export function PropertyMediaUploader({
  propertyId,
  initialMedia,
  onMediaChange,
}: PropertyMediaUploaderProps): React.JSX.Element {
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [uploads, setUploads] = useState<
    { id: string; fileName: string; status: 'uploading' | 'done' | 'error'; message?: string }[]
  >([]);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const refreshMedia = useCallback(async (): Promise<MediaItem[]> => {
    const items = await listMedia(propertyId);
    setMedia(items);
    onMediaChange(items);
    return items;
  }, [onMediaChange, propertyId]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const { ok, error } = validateMediaFiles(files);
      if (error) {
        setGlobalError(error);
        return;
      }
      setGlobalError(null);
      setIsUploading(true);
      const startPosition = media.length;
      const ids = ok.map(
        (f) => `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      );

      setUploads((prev) => [
        ...prev,
        ...ok.map((f, i) => ({
          id: ids[i],
          fileName: f.name,
          status: 'uploading' as const,
        })),
      ]);

      await Promise.all(
        ok.map(async (file, i) => {
          const id = ids[i];
          try {
            await uploadMedia(propertyId, file, startPosition + i);
            setUploads((prev) =>
              prev.map((u) => (u.id === id ? { ...u, status: 'done' } : u)),
            );
          } catch (err) {
            const message =
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : 'Échec de l’upload';
            setUploads((prev) =>
              prev.map((u) =>
                u.id === id ? { ...u, status: 'error', message } : u,
              ),
            );
          }
        }),
      );

      try {
        await refreshMedia();
      } catch (err) {
        setGlobalError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de rafraîchir la galerie.',
        );
      }
      setIsUploading(false);
    },
    [media.length, propertyId, refreshMedia],
  );

  const galleryItems: MediaGalleryItem[] = media.map((m) => ({
    id: m.id,
    url: m.url,
    type: m.type,
  }));

  return (
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
        <button
          type="button"
          disabled={isUploading}
          onClick={() => photoInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-input-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
        >
          <Icon icon="mdi:image-plus" className="h-4 w-4" />
          Ajouter des photos
        </button>
        <button
          type="button"
          disabled={isUploading}
          onClick={() => videoInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg border border-input-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
        >
          <Icon icon="mdi:video-plus" className="h-4 w-4" />
          Ajouter une vidéo
        </button>
      </div>

      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void handleFiles(files);
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void handleFiles(files);
        }}
      />

      {globalError ? (
        <p className="text-sm text-danger" role="alert">
          {globalError}
        </p>
      ) : null}

      {uploads.length > 0 ? (
        <ul className="space-y-1 text-xs">
          {uploads.map((u) => (
            <li
              key={u.id}
              className={
                u.status === 'error'
                  ? 'text-danger'
                  : u.status === 'done'
                    ? 'text-success'
                    : 'text-muted'
              }
            >
              {u.fileName} —{' '}
              {u.status === 'uploading'
                ? 'envoi…'
                : u.status === 'done'
                  ? 'ajouté'
                  : (u.message ?? 'erreur')}
            </li>
          ))}
        </ul>
      ) : null}

      <MediaGallery
        items={galleryItems}
        emptyLabel="Ajoutez des photos ou une vidéo pour valoriser le bien."
      />
    </div>
  );
}
