import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  align?: 'start' | 'end';
}

export function Breadcrumb({
  items,
  align = 'start',
}: BreadcrumbProps): React.JSX.Element {
  if (items.length === 0) return <></>;

  return (
    <nav
      aria-label="Fil d'Ariane"
      className={align === 'end' ? 'text-end' : undefined}
    >
      <ol
        className={
          'inline-flex flex-wrap items-center gap-1.5 text-base text-muted ' +
          (align === 'end' ? 'justify-end' : '')
        }
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
              {index > 0 ? (
                <span className="text-muted/60" aria-hidden>
                  ›
                </span>
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="transition-colors hover:text-accent"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={isLast ? 'text-muted' : undefined}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
