import Link from 'next/link';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  className?: string;
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = 'Voir tout',
  columns,
  rows,
  emptyMessage = 'Aucune donnée',
}: DataTableProps<T>): React.JSX.Element {
  return (
    <div className="rounded-md border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-base font-semibold text-heading">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          ) : null}
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-accent/40 hover:text-foreground"
          >
            {viewAllLabel}
          </Link>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-muted">
              {columns.map((col) => (
                <th key={col.key} className={'px-5 py-3 ' + (col.className ?? '')}>
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-8 text-center text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="transition-colors hover:bg-card-hover/60"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={'px-5 py-3.5 text-foreground ' + (col.className ?? '')}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
}): React.JSX.Element {
  const tones = {
    success: 'bg-success/15 text-success',
    warning: 'bg-warning/15 text-warning',
    danger: 'bg-danger/15 text-danger',
    neutral: 'bg-border/60 text-muted',
  };
  return (
    <span
      className={
        'inline-flex rounded-md px-2 py-0.5 text-xs font-medium ' + tones[tone]
      }
    >
      {label}
    </span>
  );
}
