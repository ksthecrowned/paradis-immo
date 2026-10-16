'use client';

import { usePathname } from 'next/navigation';
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';
import { breadcrumbForPath } from '@/lib/routes';
import { PageHeader } from './page-header';

export interface DashboardPageHeaderProps {
  title: string;
  description?: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

/**
 * Header used across non-dashboard dashboard pages (listings, details, etc.).
 * Wraps PageHeader with the breadcrumb strip below the title.
 */
export function DashboardPageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: DashboardPageHeaderProps): React.JSX.Element {
  const pathname = usePathname() ?? '';
  const crumbs = breadcrumb ?? breadcrumbForPath(pathname);

  return (
    <div>
      {crumbs.length > 0 ? (
        <div className="mb-2">
          <Breadcrumb items={crumbs} />
        </div>
      ) : null}
      <PageHeader title={title} description={description} actions={actions} />
    </div>
  );
}
