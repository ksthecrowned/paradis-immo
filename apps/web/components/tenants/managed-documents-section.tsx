'use client';

import { Button } from '@/components/primitives';
import { ApiError } from '@/lib/api';
import { useRef, useState } from 'react';

export type ManagedDocItem = {
  id: string;
  type: string;
  url: string;
  name: string;
  createdAt: string;
};

type Props = {
  title: string;
  emptyHint: string;
  typeOptions: Array<{ value: string; label: string }>;
  typeLabels: Record<string, string>;
  items: ManagedDocItem[];
  busy: boolean;
  onUpload: (file: File, type: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function ManagedDocumentsSection({
  title,
  emptyHint,
  typeOptions,
  typeLabels,
  items,
  busy,
  onUpload,
  onDelete,
}: Props): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState(typeOptions[0]?.value ?? '');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setLocalError(null);
    try {
      await onUpload(file, type);
    } catch (err) {
      setLocalError(
        err instanceof ApiError ? err.message : 'Upload impossible.',
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-heading">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-lg border border-input-border bg-search px-3 py-2 text-sm"
          >
            {typeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <Button
            variant="secondary"
            size="sm"
            loading={busy}
            onClick={() => inputRef.current?.click()}
          >
            Ajouter
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => void handleFile(e)}
          />
        </div>
      </div>
      {localError ? (
        <p className="text-sm text-danger">{localError}</p>
      ) : null}
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          {emptyHint}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium text-foreground">{d.name}</p>
                <p className="text-xs text-muted">
                  {typeLabels[d.type] ?? d.type}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  Ouvrir
                </a>
                <button
                  type="button"
                  className="text-danger hover:underline"
                  disabled={busy}
                  onClick={() => {
                    if (!confirm('Supprimer ce document ?')) return;
                    void onDelete(d.id).catch((err) => {
                      setLocalError(
                        err instanceof ApiError
                          ? err.message
                          : 'Suppression impossible.',
                      );
                    });
                  }}
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
