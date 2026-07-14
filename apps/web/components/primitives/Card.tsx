import type { ReactNode } from 'react';

type CardProps = {
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
        'rounded-2xl bg-card',
        bordered ? 'border border-border' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
