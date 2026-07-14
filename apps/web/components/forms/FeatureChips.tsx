'use client';

import { Icon } from '@iconify/react';

export type FeatureChipItem = {
  id: string;
  label: string;
  icon?: string;
};

export type FeatureChipsProps = {
  items: FeatureChipItem[];
  /** Controlled set of selected ids. */
  value: string[];
  onChange: (value: string[]) => void;
  name?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** Optional hint shown above the chips. */
  hint?: string;
  /** Optional empty-state text when no items are available. */
  emptyLabel?: string;
};

export function FeatureChips({
  items,
  value,
  onChange,
  name,
  disabled = false,
  invalid = false,
  hint,
  emptyLabel = 'Aucun élément disponible.',
}: FeatureChipsProps): React.JSX.Element {
  const selected = new Set(value);
  const toggle = (id: string) => {
    if (disabled) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(items.filter((i) => next.has(i.id)).map((i) => i.id));
  };

  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-card-hover p-4 text-sm text-muted">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div>
      {hint ? <p className="mb-2 text-sm text-muted">{hint}</p> : null}
      <input
        type="hidden"
        name={name}
        value={value.join(',')}
      />
      <div
        role="group"
        aria-invalid={invalid || undefined}
        className={[
          'flex flex-wrap gap-2',
          invalid ? 'rounded-lg ring-1 ring-danger/40 p-1' : '',
        ].join(' ')}
      >
        {items.map((item) => {
          const isSelected = selected.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => toggle(item.id)}
              disabled={disabled}
              aria-pressed={isSelected}
              className={[
                'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                isSelected
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-input-border bg-card text-foreground hover:border-accent/40 hover:text-accent',
                disabled ? 'cursor-not-allowed opacity-50' : '',
              ].join(' ')}
            >
              {item.icon ? (
                <Icon icon={item.icon} className="h-4 w-4" />
              ) : null}
              {item.label}
              {isSelected ? (
                <Icon icon="mdi:check" className="h-4 w-4" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
