import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

export type FormSidebarSection = {
  /** Section title (e.g. "Statut", "Métadonnées"). */
  title: string;
  /** Optional icon. */
  icon?: string;
  /** Section content. */
  children: ReactNode;
};

/**
 * Renders a group of sections inside a FormLayout sidebar. Each section
 * is a labeled block with optional icon. Use the dedicated helpers
 * below (StatusBadge, MetaList, TipBox, ActionList) for the standard
 * cases.
 */
export function FormSidebar({
  sections,
  className = '',
}: {
  sections: FormSidebarSection[];
  className?: string;
}): React.JSX.Element {
  return (
    <div className={`space-y-4 ${className}`}>
      {sections.map((s, idx) => (
        <section
          key={`${s.title}-${idx}`}
          className="rounded-lg border border-border bg-card p-5"
        >
          <header className="mb-3 flex items-center gap-2">
            {s.icon ? (
              <Icon icon={s.icon} className="h-4 w-4 text-muted" />
            ) : null}
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {s.title}
            </h3>
          </header>
          <div className="space-y-2">{s.children}</div>
        </section>
      ))}
    </div>
  );
}

export type FormSidebarRow = {
  label: string;
  value: ReactNode;
};

export function MetaList({ rows }: { rows: FormSidebarRow[] }): React.JSX.Element {
  return (
    <dl className="divide-y divide-border text-sm">
      {rows.map((r) => (
        <div
          key={r.label}
          className="flex items-start justify-between gap-3 py-2 first:pt-0 last:pb-0"
        >
          <dt className="text-muted">{r.label}</dt>
          <dd className="text-end text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export type FormSidebarTip = {
  icon?: string;
  title: string;
  body: string;
};

export function TipBox({ tips }: { tips: FormSidebarTip[] }): React.JSX.Element {
  return (
    <ul className="space-y-3">
      {tips.map((t, idx) => (
        <li key={idx} className="flex gap-3">
          <Icon
            icon={t.icon ?? 'mdi:lightbulb-on-outline'}
            className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{t.title}</p>
            <p className="mt-0.5 text-xs text-muted">{t.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export type FormSidebarAction = {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
};

export function ActionList({
  actions,
}: {
  actions: FormSidebarAction[];
}): React.JSX.Element {
  const variantClass = (v: FormSidebarAction['variant']): string => {
    switch (v) {
      case 'danger':
        return 'border-danger/30 text-danger hover:bg-danger/10';
      case 'secondary':
        return 'border-border text-foreground hover:bg-card-hover';
      case 'ghost':
        return 'border-transparent text-muted hover:bg-card-hover hover:text-foreground';
      case 'primary':
      default:
        return 'border-accent bg-accent text-white hover:bg-accent-light';
    }
  };
  return (
    <ul className="space-y-2">
      {actions.map((a, idx) => (
        <li key={`${a.label}-${idx}`}>
          <button
            type="button"
            onClick={a.onClick}
            disabled={a.disabled || a.loading}
            className={[
              'flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
              'disabled:cursor-not-allowed disabled:opacity-50',
              variantClass(a.variant),
            ].join(' ')}
          >
            {a.loading ? (
              <Icon icon="mdi:loading" className="h-4 w-4 animate-spin" />
            ) : a.icon ? (
              <Icon icon={a.icon} className="h-4 w-4" />
            ) : null}
            {a.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export type StatusBadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger';

const TONE: Record<StatusBadgeTone, string> = {
  neutral: 'border-border bg-card-hover text-muted',
  accent: 'border-accent/30 bg-accent/15 text-accent',
  success: 'border-success/30 bg-success/15 text-success',
  warning: 'border-warning/30 bg-warning/15 text-warning',
  danger: 'border-danger/30 bg-danger/15 text-danger',
};

export function StatusPill({
  label,
  tone = 'neutral',
  icon,
}: {
  label: string;
  tone?: StatusBadgeTone;
  icon?: string;
}): React.JSX.Element {
  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        TONE[tone],
      ].join(' ')}
    >
      {icon ? <Icon icon={icon} className="h-3.5 w-3.5" /> : null}
      {label}
    </span>
  );
}
