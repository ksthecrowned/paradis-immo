import { DashIcon } from '@/components/dash-icon';
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
          'inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted ' +
          (align === 'end' ? 'justify-end' : '')
        }
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const isFirst = index === 0;
          return (
            <li
              key={`${item.label}-${index}`}
              className="inline-flex items-center gap-1.5"
            >
              {index > 0 ? (
                <DashIcon
                  icon="solar:alt-arrow-right-linear"
                  width={12}
                  height={12}
                  className="text-muted/50"
                  aria-hidden
                />
              ) : null}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors hover:bg-card-hover hover:text-foreground"
                >
                  {isFirst ? (
                    <DashIcon
                      icon="solar:home-smile-linear"
                      width={14}
                      height={14}
                      aria-hidden
                    />
                  ) : null}
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? 'inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-medium text-foreground'
                      : undefined
                  }
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
