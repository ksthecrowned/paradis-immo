import type { ReactNode } from 'react';

export type FormLayoutProps = {
  /** The main form column. */
  children: ReactNode;
  /** The sidebar (meta + actions) column. May be omitted to render single-column. */
  sidebar?: ReactNode;
  /** Sticky sidebar on desktop so it follows scroll. Default: true. */
  stickySidebar?: boolean;
  className?: string;
};

/**
 * Two-column form layout: form on the left (2/3), sidebar on the right
 * (1/3). On screens < lg, both columns stack vertically with the
 * sidebar at the bottom.
 *
 * Use with <FormSidebar> for the right column.
 */
export function FormLayout({
  children,
  sidebar,
  stickySidebar = true,
  className = '',
}: FormLayoutProps): React.JSX.Element {
  return (
    <div
      className={[
        'grid grid-cols-1 gap-6',
        sidebar ? 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]' : '',
        className,
      ].join(' ')}
    >
      <div className="min-w-0">{children}</div>
      {sidebar ? (
        <div
          className={[
            'min-w-0',
            stickySidebar ? 'lg:sticky lg:top-20 lg:self-start' : '',
          ].join(' ')}
        >
          {sidebar}
        </div>
      ) : null}
    </div>
  );
}
