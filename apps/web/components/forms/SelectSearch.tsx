'use client';

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
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
};

/**
 * Native-styled select. The original "search overlay" was not reliable
 * (the native select swallowed the text input). For entity lists that
 * are short (cities, arrondissements, quartiers) a native select with
 * Preline styling is the right tradeoff. A real combobox can be added
 * later if we need to filter long lists.
 */
export function SelectSearch({
  name,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner…',
  invalid = false,
  disabled = false,
  className = '',
}: SelectSearchProps): React.JSX.Element {
  const BASE =
    'block w-full rounded-lg border bg-search px-3 py-2.5 text-sm text-foreground focus:ring-2 focus:outline-none';
  const STATE = invalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : 'border-input-border focus:border-input-focus-border focus:ring-accent/30';
  const DISABLED = disabled ? 'cursor-not-allowed opacity-50' : '';

  return (
    <div className="relative">
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`${BASE} ${STATE} ${DISABLED} appearance-none pr-9 ${className}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted"
      >
        <Icon icon="mdi:chevron-down" className="h-4 w-4" />
      </span>
    </div>
  );
}
