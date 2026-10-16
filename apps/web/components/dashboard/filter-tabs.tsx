'use client';

import { DashIcon } from '@/components/dash-icon';

export type FilterTabItem<T extends string = string> = {
  id: T;
  label: string;
  /** Iconify icon name (Solar set preferred). */
  icon?: string;
  /** Optional count badge. Omit when unknown. */
  count?: number;
};

export type FilterTabsProps<T extends string = string> = {
  items: FilterTabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the tab list. */
  ariaLabel: string;
  className?: string;
};

/**
 * Underline tab filters for dashboard tables — inspired by approval-type
 * navs: icon + label + optional count badge, accent underline when selected.
 */
export function FilterTabs<T extends string = string>({
  items,
  value,
  onChange,
  ariaLabel,
  className = '',
}: FilterTabsProps<T>): React.JSX.Element {
  return (
    <div className={`overflow-x-auto border-b border-border ${className}`.trim()}>
      <nav
        className="flex min-w-max gap-0 px-1"
        role="tablist"
        aria-label={ariaLabel}
      >
        {items.map((item) => {
          const selected = item.id === value;
          const hasCount = typeof item.count === 'number';
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(item.id)}
              className={
                'relative inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ' +
                (selected
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:bg-card-hover/60 hover:text-foreground')
              }
            >
              {item.icon ? (
                <DashIcon
                  icon={item.icon}
                  width={14}
                  height={14}
                  className="opacity-70"
                />
              ) : null}
              <span>{item.label}</span>
              {hasCount ? (
                <span
                  className={
                    'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ' +
                    (selected
                      ? 'bg-accent/15 text-accent'
                      : 'bg-search text-muted')
                  }
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
