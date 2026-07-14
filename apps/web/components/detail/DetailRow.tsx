import type { ReactNode } from 'react';

export type DetailRowProps = {
  label: string;
  value?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function DetailRow({
  label,
  value,
  children,
  className = '',
}: DetailRowProps): React.JSX.Element {
  return (
    <div className={`grid gap-1 px-5 py-3.5 md:grid-cols-3 ${className}`}>
      <dt className="text-sm font-medium text-muted">{label}</dt>
      <dd className="text-sm text-foreground md:col-span-2">
        {children ?? (value === null || value === undefined || value === '' ? '—' : value)}
      </dd>
    </div>
  );
}
