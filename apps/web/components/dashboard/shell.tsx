'use client';

import { DashIcon } from '@/components/dash-icon';
import { DASH_ICONS } from '@/lib/dash-icons';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BrandMark } from './brand-mark';
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

/**
 * Tracks the lg breakpoint AND whether the component has mounted on the
 * client. We need both: `isLg` drives the sidebar offset, and we can't
 * know its value on the server. The `mounted` flag lets us skip the
 * first paint entirely (no sidebar, no main) to avoid a flash where
 * the main renders with margin=0 and then slides to the right.
 */
function useIsLg(): { isLg: boolean; mounted: boolean } {
  const [isLg, setIsLg] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = (): void => setIsLg(mq.matches);
    update();
    setMounted(true);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return { isLg, mounted };
}

export interface DashboardShellProps {
  role: DashboardRole;
  children: React.ReactNode;
}

const SIDEBAR_FULL = 250;
const SIDEBAR_COLLAPSED = 72;

export function DashboardShell({
  role,
  children,
}: DashboardShellProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const { isLg, mounted } = useIsLg();
  usePrelineInit();

  // Premier render côté client : on sait que `mounted` est false car
  // useEffect n'a pas encore tourné. On évite ainsi tout flash SSR/hydratation
  // où le main apparaît collé à gauche avant que isLg passe à true.
  if (!mounted) {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_FULL;
  const mainOffset = isLg ? sidebarWidth : 0;

  function toggleSidebar(): void {
    if (!isLg) {
      setMobileOpen((v) => !v);
    } else {
      setCollapsed((v) => !v);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 flex h-[70px] bg-topbar">
        <div
          className="hidden shrink-0 items-center border-e border-border px-5 transition-[width] duration-200 lg:flex"
          style={{ width: isLg ? sidebarWidth : SIDEBAR_FULL }}
        >
          <BrandMark compact={collapsed} />
        </div>
        <Topbar onMenuClick={toggleSidebar} />
      </header>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          aria-label="Fermer le menu"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside
        className={
          'fixed bottom-0 start-0 top-[70px] z-50 border-e border-border bg-sidebar transition-[width,transform] duration-200 lg:translate-x-0 ' +
          (mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0')
        }
        style={{ width: mobileOpen ? SIDEBAR_FULL : sidebarWidth }}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <BrandMark />
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-card"
            aria-label="Fermer"
            onClick={() => setMobileOpen(false)}
          >
            <DashIcon icon={DASH_ICONS.close} width={20} height={20} />
          </button>
        </div>
        <SidebarNav
          role={role}
          collapsed={collapsed && !mobileOpen}
          onNavigate={() => setMobileOpen(false)}
        />
      </aside>

      <main
        className="min-h-[calc(100vh-70px)] transition-[margin] duration-200"
        style={{ marginInlineStart: mainOffset }}
      >
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
