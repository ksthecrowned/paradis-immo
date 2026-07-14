import type { ReactNode } from 'react';

export type DetailSectionProps = {
  columns?: 1 | 2 | 3;
  className?: string;
  children: ReactNode;
};

const COLS_CLASS: Record<1 | 2 | 3, string> = {
  1: 'grid gap-6',
  2: 'grid gap-6 lg:grid-cols-2',
  3: 'grid gap-6 lg:grid-cols-2 xl:grid-cols-3',
};

export function DetailSection({
  columns = 2,
  className = '',
  children,
}: DetailSectionProps): React.JSX.Element {
  return <div className={`${COLS_CLASS[columns]} ${className}`}>{children}</div>;
}
