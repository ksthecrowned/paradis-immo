'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Breadcrumb, type BreadcrumbItem } from './breadcrumb';
import { SidebarNav, type DashboardRole } from './sidebar-nav';
import { Topbar } from './topbar';

function usePrelineInit(): void {
  const pathname = usePathname();
  useEffect(() => {
    void import('preline').then(() => {
      const win = window as Window & {
        HSStaticMethods?: { autoInit: () => void };
      };
      win.HSStaticMethods?.autoInit();
    });
  }, [pathname]);
}

export interface DashboardShellProps {
  role: DashboardRole;
  breadcrumb?: BreadcrumbItem[];
  children: React.ReactNode;
}

export function DashboardShell({
  role,
  breadcrumb = [],
  children,
}: DashboardShellProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  usePrelineInit();

  const mobileTitle =
    breadcrumb.length > 0
      ? breadcrumb[breadcrumb.length - 1]?.label
      : undefined;

  return (
    <div className="min-h-screen bg-dash-bg text-dash-text">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={
          'fixed inset-y-0 start-0 z-50 w-64 border-e border-dash-border bg-dash-sidebar transition-transform duration-200 lg:translate-x-0 ' +
          (mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
        }
      >
        <div className="flex items-center justify-end border-b border-dash-border p-2 lg:hidden">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-dash-text-muted hover:bg-dash-card"
            aria-label="Fermer la navigation"
            onClick={() => setMobileOpen(false)}
          >
            <X className="size-5" />
          </button>
        </div>
        <SidebarNav role={role} onNavigate={() => setMobileOpen(false)} />
      </aside>

      <div className="lg:ps-64">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-dash-border bg-dash-sidebar px-4 lg:hidden">
          <button
            type="button"
            className="inline-flex size-9 items-center justify-center rounded-lg text-dash-text-muted hover:bg-dash-card"
            aria-label="Ouvrir la navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </button>
          <span className="text-sm font-medium text-dash-text">
            {mobileTitle ?? 'Paradis Immo'}
          </span>
        </div>

        <Topbar title={mobileTitle} />

        <main className="p-4 sm:p-6 lg:p-8">
          {breadcrumb.length > 0 ? <Breadcrumb items={breadcrumb} /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
