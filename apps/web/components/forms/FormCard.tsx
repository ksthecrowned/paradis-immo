import { Card } from '@/components/primitives';
import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

export type FormCardProps = {
  title: string;
  hint?: string;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function FormCard({
  title,
  hint,
  footer,
  className = '',
  children,
}: FormCardProps): React.JSX.Element {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="border-b-4 border-t-0 border-accent">
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {hint ? (
              <span title={hint} className="text-muted">
                <Icon icon="mdi:information-outline" className="h-4 w-4" />
              </span>
            ) : null}
          </div>
        </div>
        <div className="p-5 md:p-6">{children}</div>
        {footer ? (
          <div className="border-t border-border bg-card-hover px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
