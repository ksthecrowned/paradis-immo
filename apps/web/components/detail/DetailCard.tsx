import { Card } from '@/components/primitives';
import type { ReactNode } from 'react';

export type DetailCardProps = {
  title?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function DetailCard({
  title,
  actions,
  className = '',
  children,
}: DetailCardProps): React.JSX.Element {
  return (
    <Card className={`overflow-hidden ${className}`}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          {title ? (
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          ) : (
            <span />
          )}
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <dl className="divide-y divide-border">{children}</dl>
    </Card>
  );
}
