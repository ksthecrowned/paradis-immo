import type { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  label: string;
  value: number | string | null;
  hint?: string;
  trend?: { value: string; positive?: boolean };
  icon?: LucideIcon;
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
}: StatCardProps): React.JSX.Element {
  const display =
    value === null || value === undefined ? '—' : String(value);

  return (
    <div className="rounded-xl border border-dash-border bg-dash-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-dash-text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-dash-text">
            {display}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-dash-text-muted">{hint}</p>
          ) : null}
          {trend ? (
            <p
              className={
                'mt-2 text-xs font-medium ' +
                (trend.positive ? 'text-dash-success' : 'text-dash-danger')
              }
            >
              {trend.value}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-dash-accent/15 text-dash-accent">
            <Icon className="size-5" aria-hidden />
          </div>
        ) : null}
      </div>
    </div>
  );
}
