import type { ReactNode } from 'react';

export type CardProps = {
  bordered?: boolean;
  className?: string;
  children: ReactNode;
};

export function Card({
  bordered = true,
  className = '',
  children,
}: CardProps): React.JSX.Element {
  return (
    <div
      className={[
        'rounded-lg bg-card',
        bordered ? 'border border-border' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
