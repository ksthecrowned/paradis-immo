'use client';

import { useMemo, useState } from 'react';

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
  emptyLabel?: string;
  className?: string;
};

export function SelectSearch({
  name,
  value,
  onChange,
  options,
  placeholder = 'Sélectionner…',
  invalid = false,
  disabled = false,
  emptyLabel = 'Aucun résultat',
  className = '',
}: SelectSearchProps): React.JSX.Element {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.hint?.toLowerCase().includes(q) ?? false),
    );
  }, [options, query]);

  const current = options.find((o) => o.value === value);

  return (
    <div className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        role="combobox"
        aria-expanded={false}
        placeholder={current ? current.label : placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
        className={[
          'block w-full rounded-lg border bg-search px-3 py-2.5 pr-9 text-sm text-foreground placeholder:text-muted',
          'focus:ring-2 focus:outline-none',
          invalid
            ? 'border-danger focus:border-danger focus:ring-danger/30'
            : 'border-input-border focus:border-input-focus-border focus:ring-accent/30',
          disabled ? 'cursor-not-allowed opacity-50' : '',
        ].join(' ')}
      />
      <select
        aria-label={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setQuery('');
        }}
        disabled={disabled}
        className="absolute inset-0 cursor-pointer appearance-none bg-transparent px-3 py-2.5 text-sm text-transparent focus:outline-none"
      >
        <option value="">{placeholder}</option>
        {filtered.length === 0 ? (
          <option value={value} disabled>
            {emptyLabel}
          </option>
        ) : (
          filtered.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
