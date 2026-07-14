'use client';

import { useCallback, useState } from 'react';
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

  const refreshMedia = useCallback(async (): Promise<MediaItem[]> => {
    const items = await listMedia(propertyId);
    setMedia(items);
    onMediaChange(items);
    return items;
  }, [onMediaChange, propertyId]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setGlobalError(null);
      setIsUploading(true);
      const startPosition = media.length;
      const ids = files.map(
        (f) => `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      );

      setUploads((prev) => [
        ...prev,
        ...files.map((f, i) => ({
          id: ids[i],
          fileName: f.name,
          status: 'uploading' as const,
        })),
      ]);

      // Upload in parallel; track each one.
      await Promise.all(
        files.map(async (file, i) => {
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
  }));

  return (
    <div className="space-y-4">
      <DropZone
        onFiles={handleFiles}
        accept="image/*"
        multiple
        disabled={isUploading}
        title="Glissez vos photos ici"
        hint="ou cliquez pour parcourir"
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
                  ? 'ajoutée'
                  : (u.message ?? 'erreur')}
            </li>
          ))}
        </ul>
      ) : null}

      <MediaGallery
        items={galleryItems}
        emptyLabel="Aucune photo. Ajoutez au moins une image pour présenter le bien."
      />
    </div>
  );
}
