'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  ACTIVE_ROLE_LABELS,
  setActiveRole,
  type ActiveRole,
} from '@/lib/active-role';
import {
  listMyOrganizations,
  resolveEligibleDashboardRoles,
} from '@/lib/me';

const ROLE_PATHS: Record<ActiveRole, string> = {
  owner: '/owner/dashboard',
  agent: '/agent/dashboard',
  admin: '/admin/dashboard',
};

export function RoleSwitcher(): React.JSX.Element | null {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [eligible, setEligible] = useState<ActiveRole[]>([]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user) {
      setEligible([]);
      return;
    }
    void (async () => {
      try {
        const orgs = await listMyOrganizations();
        setEligible(
          resolveEligibleDashboardRoles(session.user.roles ?? [], orgs),
        );
      } catch {
        setEligible(resolveEligibleDashboardRoles(session.user.roles ?? [], []));
      }
    })();
  }, [session, status]);

  const currentRole = (pathname.split('/')[1] ?? 'owner') as ActiveRole;

  const handleChange = useCallback(
    (role: ActiveRole) => {
      if (role === currentRole) return;
      setActiveRole(role);
      router.push(ROLE_PATHS[role]);
    },
    [currentRole, router],
  );

  if (eligible.length <= 1) return null;

  return (
    <label className="hidden items-center gap-2 sm:flex">
      <span className="sr-only">Rôle actif</span>
      <select
        value={eligible.includes(currentRole) ? currentRole : eligible[0]}
        onChange={(e) => handleChange(e.target.value as ActiveRole)}
        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground"
        aria-label="Changer de rôle"
      >
        {eligible.map((role) => (
          <option key={role} value={role}>
            {ACTIVE_ROLE_LABELS[role]}
          </option>
        ))}
      </select>
    </label>
  );
}
