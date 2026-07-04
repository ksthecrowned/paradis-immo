'use client';

import { usePathname } from 'next/navigation';
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';
import { DashboardDecorations } from './dashboard-decorations';
import { breadcrumbForPath } from '@/lib/routes';

export interface DashboardPageHeaderProps {
  title: string;
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
}

export function DashboardPageHeader({
  title,
  breadcrumb,
  actions,
}: DashboardPageHeaderProps): React.JSX.Element {
  const pathname = usePathname() ?? '';
  const crumbs = breadcrumb ?? breadcrumbForPath(pathname);

  return (
    <div className="relative mb-6">
      <DashboardDecorations />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-heading">{title}</h1>
        {crumbs.length > 0 ? <Breadcrumb items={crumbs} align="end" /> : null}
      </div>
      {actions ? (
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
