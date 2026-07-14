'use client';

import { useCallback, useRef, useState, type DragEvent } from 'react';
import { Icon } from '@iconify/react';

export type DropZoneProps = {
  /** Called with the user's selected files. The component never reads files itself. */
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  disabled?: boolean;
  title?: string;
  hint?: string;
  className?: string;
};

/**
 * DropZone — drop-or-click area for file selection.
 *
 * Pure presentational + drag-state. File reading and upload are the
 * parent's responsibility (see `FileUpload` for the higher-level
 * wrapper that handles the input click + file validation).
 */
export function DropZone({
  onFiles,
  accept = 'image/*',
  multiple = true,
  maxSizeMb = 10,
  disabled = false,
  title = 'Glissez vos fichiers ici',
  hint = 'ou cliquez pour parcourir',
  className = '',
}: DropZoneProps): React.JSX.Element {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validate = useCallback(
    (files: FileList | File[]): File[] => {
      const arr = Array.from(files);
      const valid: File[] = [];
      for (const f of arr) {
        if (f.size > maxSizeMb * 1024 * 1024) {
          setError(`« ${f.name} » dépasse ${maxSizeMb} Mo.`);
          continue;
        }
        valid.push(f);
      }
      if (valid.length === 0) return valid;
      setError(null);
      return valid;
    },
    [maxSizeMb],
  );

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    const files = e.dataTransfer.files;
    const valid = validate(files);
    if (valid.length) onFiles(multiple ? valid : [valid[0]]);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.dataTransfer.types.includes('Files')) setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const openPicker = (): void => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (!e.target.files) return;
    const valid = validate(e.target.files);
    if (valid.length) onFiles(multiple ? valid : [valid[0]]);
    e.target.value = '';
  };

  return (
    <div className={className}>
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        className={[
          'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
          dragOver
            ? 'border-accent bg-accent/10 text-foreground'
            : 'border-input-border bg-search/40 text-muted hover:border-accent/50 hover:text-foreground',
          disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
        ].join(' ')}
      >
        <Icon
          icon={dragOver ? 'mdi:cloud-download' : 'mdi:cloud-upload-outline'}
          className="h-10 w-10"
        />
        <p className="text-base font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted">{hint}</p>
        <p className="text-xs text-muted">Taille max. : {maxSizeMb} Mo</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
