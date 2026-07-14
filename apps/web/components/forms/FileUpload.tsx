'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';
import { DropZone, type DropZoneProps } from './DropZone';

export type FileUploadItem = {
  /** Stable id (parent-provided). */
  id: string;
  name: string;
  size: number;
  previewUrl?: string;
};

export type FileUploadProps = Omit<DropZoneProps, 'onFiles'> & {
  /** Maximum number of files (after which new uploads are rejected). */
  maxFiles?: number;
  /** Called whenever the upload queue changes — parent owns the state. */
  onQueueChange: (queue: FileUploadItem[]) => void;
  /** Called when the user drops/selects new files. */
  onFilesAdded: (files: File[]) => void;
  /** Render each queued item (e.g. progress / preview). */
  renderItem?: (item: FileUploadItem, remove: () => void) => React.ReactNode;
};

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

/**
 * FileUpload — DropZone + persistent queue.
 *
 * The component owns the list of pending files and their preview URLs;
 * the parent receives `onFilesAdded` to actually upload them and may
 * render progress / previews through `renderItem`.
 */
export function FileUpload({
  onQueueChange,
  onFilesAdded,
  renderItem,
  maxFiles,
  accept = 'image/*',
  multiple = true,
  disabled = false,
  className = '',
  ...dropZoneProps
}: FileUploadProps): React.JSX.Element {
  const [queue, setQueue] = useState<FileUploadItem[]>([]);

  const updateQueue = (next: FileUploadItem[]): void => {
    setQueue(next);
    onQueueChange(next);
  };

  const remove = (id: string): void => {
    setQueue((prev) => {
      const next = prev.filter((q) => {
        if (q.id !== id) return true;
        if (q.previewUrl) URL.revokeObjectURL(q.previewUrl);
        return false;
      });
      onQueueChange(next);
      return next;
    });
  };

  const handleFiles = (files: File[]): void => {
    if (maxFiles) {
      const remaining = maxFiles - queue.length;
      if (remaining <= 0) {
        onFilesAdded([]);
        return;
      }
      files = files.slice(0, remaining);
    }
    const newItems: FileUploadItem[] = files.map((f) => ({
      id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      size: f.size,
      previewUrl: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined,
    }));
    const next = multiple ? [...queue, ...newItems] : newItems.slice(0, 1);
    updateQueue(next);
    onFilesAdded(files);
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <DropZone
        onFiles={handleFiles}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        {...dropZoneProps}
      />

      {queue.length > 0 ? (
        <ul className="space-y-2">
          {queue.map((item) => {
            const removeFn = (): void => remove(item.id);
            if (renderItem) {
              return <li key={item.id}>{renderItem(item, removeFn)}</li>;
            }
            return (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-2"
              >
                {item.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="h-12 w-12 flex-shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md bg-search text-muted">
                    <Icon icon="mdi:file-outline" className="h-6 w-6" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{item.name}</p>
                  <p className="text-xs text-muted">{formatSize(item.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={removeFn}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-muted hover:bg-card-hover hover:text-danger"
                  aria-label={`Retirer ${item.name}`}
                >
                  <Icon icon="mdi:close" className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
