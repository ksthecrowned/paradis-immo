'use client';

import { DashIcon } from '@/components/dash-icon';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PROFILE_TABS } from './profile-nav';

export function ProfileShell({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const pathname = usePathname() ?? '';

  return (
    <div className="space-y-5">
      <div className="flex max-w-full flex-col gap-y-6 rounded-xl border border-border bg-table md:flex-row md:gap-y-0 lg:min-h-150">
        <nav
          className="flex w-full shrink-0 flex-col gap-2 self-stretch border-border px-3 py-6 lg:max-w-xs lg:border-e"
          aria-label="Sections du profil"
        >
          {PROFILE_TABS.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-active={isActive}
                className={
                  'flex w-full items-start gap-3 rounded-xl p-2 transition-colors ' +
                  (isActive
                    ? 'bg-search'
                    : 'hover:bg-card-hover/60')
                }
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-search text-muted">
                  <DashIcon icon={item.icon} width={20} height={20} />
                </span>
                <span className="flex min-w-0 flex-col items-start gap-1">
                  <span className="text-sm font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="text-xs font-normal text-muted">
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="w-full flex-1 p-5 sm:p-6">{children}</div>
      </div>
    </div>
  );
}
