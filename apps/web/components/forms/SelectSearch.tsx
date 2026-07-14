'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
  'block w-full rounded-lg border bg-search px-3 py-2.5 text-base text-foreground placeholder:text-placeholder focus:ring-2 focus:outline-none';
const STATE_INPUT = (invalid: boolean) =>
  invalid
    ? 'border-danger focus:border-danger focus:ring-danger/30'
    : 'border-input-border focus:border-input-focus-border focus:ring-accent/30';

type DropdownPos = { top: number; left: number; width: number };

/**
 * Combobox with text filter — use for long lists (cities,
 * arrondissements, quartiers, etc.) where filtering improves UX.
 *
 * The dropdown is rendered through a React portal so it escapes any
 * `overflow: hidden` / `transform` on the parent (tab panels, cards).
 * Position is recomputed on scroll, resize, and reopen.
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
}: SelectSearchProps): React.JSX.Element | null {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<DropdownPos | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const current = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.hint?.toLowerCase().includes(q) ?? false),
      )
    : options;

  // Position the portal dropdown under the trigger.
  const recomputePos = (): void => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      top: r.bottom + window.scrollY + 4,
      left: r.left + window.scrollX,
      width: r.width,
    });
  };

  useLayoutEffect(() => {
    if (!open) return;
    recomputePos();
    // Focus search input once mounted.
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
    const onScrollOrResize = (): void => recomputePos();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Close on click outside (trigger or dropdown).
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent): void => {
      const target = e.target as Node | null;
      if (!target) return;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const handleSelect = (v: string): void => {
    onChange(v);
    setQuery('');
    setOpen(false);
    triggerRef.current?.focus();
  };

  // SSR guard: portal requires document.
  if (typeof document === 'undefined') return null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <input type="hidden" name={name} value={value} />

      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
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

      {open && pos
        ? createPortal(
            <div
              ref={dropdownRef}
              role="listbox"
              style={{
                position: 'absolute',
                top: pos.top,
                left: pos.left,
                width: pos.width,
              }}
              className="z-50 max-h-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg"
            >
              <div className="border-b border-border p-2">
                <div className="relative">
                  <Icon
                    icon="mdi:magnify"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="block w-full rounded-lg border border-input-border bg-search py-2.5 pl-9 pr-3 text-base text-foreground placeholder:text-placeholder focus:border-input-focus-border focus:ring-2 focus:ring-accent/30 focus:outline-none"
                  />
                </div>
              </div>
              <ul className="max-h-60 overflow-y-auto py-1">
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-base text-muted">{emptyLabel}</li>
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
                            'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-base',
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
