'use client';

import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  confirmMedia,
  listMedia,
  presignMedia,
  type MediaItem,
} from '@/lib/owner/media';

interface UploadState {
  fileName: string;
  status: 'uploading' | 'done' | 'error';
  message?: string;
}

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const refreshMedia = useCallback(async () => {
    const items = await listMedia(propertyId);
    setMedia(items);
    onMediaChange(items);
    return items;
  }, [onMediaChange, propertyId]);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setGlobalError(null);
      const startPosition = media.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) {
          setUploads((prev) => [
            ...prev,
            {
              fileName: file.name,
              status: 'error',
              message: 'Seules les images sont acceptées.',
            },
          ]);
          continue;
        }

        setUploads((prev) => [
          ...prev,
          { fileName: file.name, status: 'uploading' },
        ]);

        try {
          const presign = await presignMedia(propertyId, {
            filename: file.name,
            contentType: file.type,
            type: 'PHOTO',
          });
          const putRes = await fetch(presign.uploadUrl, {
            method: 'PUT',
            body: file,
            headers: { 'Content-Type': file.type },
          });
          if (!putRes.ok) {
            throw new Error(`Upload R2 échoué (${putRes.status})`);
          }
          await confirmMedia(propertyId, {
            url: presign.fileUrl,
            type: 'PHOTO',
            position: startPosition + i,
          });
          setUploads((prev) =>
            prev.map((u) =>
              u.fileName === file.name && u.status === 'uploading'
                ? { ...u, status: 'done' }
                : u,
            ),
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
              u.fileName === file.name && u.status === 'uploading'
                ? { ...u, status: 'error', message }
                : u,
            ),
          );
        }
      }

      try {
        await refreshMedia();
      } catch (err) {
        setGlobalError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de rafraîchir la galerie.',
        );
      }

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    },
    [media.length, propertyId, refreshMedia],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
        >
          Ajouter des photos
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void handleFiles(e.target.files)}
        />
        <span className="text-xs text-muted">JPEG, PNG, WebP via Cloudflare R2</span>
      </div>

      {globalError ? (
        <p className="text-sm text-danger" role="alert">
          {globalError}
        </p>
      ) : null}

      {uploads.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {uploads.map((u, idx) => (
            <li
              key={`${u.fileName}-${idx}`}
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

      {media.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted">
          Aucune photo. Ajoutez au moins une image pour présenter le bien.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.map((item) => (
            <div
              key={item.id}
              className="relative aspect-[4/3] overflow-hidden rounded-lg border border-border bg-card"
            >
              <Image
                src={item.url}
                alt=""
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 25vw"
                unoptimized
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
