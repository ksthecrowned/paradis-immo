'use client';

import { usePathname } from 'next/navigation';
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';
import { breadcrumbForPath } from '@/lib/routes';
import { PageHeader } from './page-header';

export interface DashboardPageHeaderProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

/**
 * Header used across non-dashboard dashboard pages (listings, details, etc.).
 * Wraps PageHeader with the breadcrumb strip below the title.
 */
export function DashboardPageHeader({
  title,
  breadcrumb,
  actions,
}: DashboardPageHeaderProps): React.JSX.Element {
  const pathname = usePathname() ?? '';
  const crumbs = breadcrumb ?? breadcrumbForPath(pathname);

  return (
    <div>
      <PageHeader title={title} />
      {(crumbs.length > 0 || actions) ? (
        <div className="-mt-4 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {crumbs.length > 0 ? (
            <Breadcrumb items={crumbs} />
          ) : (
            <span />
          )}
          {actions ? (
            <div className="flex flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
