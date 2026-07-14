'use client';

import { useState } from 'react';
import { Icon } from '@iconify/react';

export type SelectSearchOption = {
  value: string;
  label: string;
  hint?: string;
};

export type SelectSearchProps = {
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectSearchOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  emptyLabel?: string;
  className?: string;
};

const BASE_INPUT =
  'block w-full rounded-lg border bg-search px-3 py-2.5 text-sm text-foreground placeholder:text-muted focus:ring-2 focus:outline-none';
const STATE_INPUT = (invalid: boolean) =>
  invalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : 'border-input-border focus:border-input-focus-border focus:ring-accent/30';

/**
 * Combobox with text filter — use for long lists (cities,
 * arrondissements, quartiers, etc.) where filtering improves UX.
 *
 * The component owns the dropdown open/close state and the local
 * query. The parent only deals with the selected `value`.
 */
export function SelectSearch({
  name,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner…',
  searchPlaceholder = 'Tapez pour rechercher…',
  invalid = false,
  disabled = false,
  emptyLabel = 'Aucun résultat',
  className = '',
}: SelectSearchProps): React.JSX.Element {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const current = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.hint?.toLowerCase().includes(q) ?? false),
      )
    : options;

  const handleSelect = (v: string) => {
    onChange(v);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} />

      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={[
          BASE_INPUT,
          STATE_INPUT(invalid),
          'flex w-full items-center justify-between gap-2 text-left',
          disabled ? 'cursor-not-allowed opacity-50' : '',
        ].join(' ')}
      >
        <span className={current ? 'text-foreground' : 'text-muted'}>
          {current?.label ?? placeholder}
        </span>
        <Icon icon="mdi:chevron-down" className="h-4 w-4 text-muted" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-20 mt-1 rounded-lg border border-border bg-card shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Icon
                icon="mdi:magnify"
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="block w-full rounded-lg border border-input-border bg-search py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted focus:border-input-focus-border focus:ring-2 focus:ring-accent/30 focus:outline-none"
              />
            </div>
          </div>
          <ul
            role="listbox"
            className="max-h-60 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">{emptyLabel}</li>
            ) : (
              filtered.map((o) => {
                const isActive = o.value === value;
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelect(o.value)}
                      className={[
                        'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm',
                        isActive
                          ? 'bg-accent/15 text-accent'
                          : 'text-foreground hover:bg-card-hover',
                      ].join(' ')}
                    >
                      <span>{o.label}</span>
                      {o.hint ? (
                        <span className="text-xs text-muted">{o.hint}</span>
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
