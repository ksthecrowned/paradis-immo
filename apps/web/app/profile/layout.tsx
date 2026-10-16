'use client';

import { DashboardShell, type DashboardRole } from '@/components/dashboard';
import { ProfileShell } from '@/components/profile/profile-shell';
import {
  resolveActiveRole,
  type ActiveRole,
} from '@/lib/active-role';
import {
  listMyOrganizations,
  resolveEligibleDashboardRoles,
} from '@/lib/me';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

function toDashboardRole(role: ActiveRole): DashboardRole {
  return role;
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { data: session, status } = useSession();
  const [role, setRole] = useState<DashboardRole | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    void (async () => {
      try {
        const orgs = await listMyOrganizations();
        if (cancelled) return;
        const eligible = resolveEligibleDashboardRoles(
          session?.user?.roles ?? [],
          orgs,
        );
        setRole(toDashboardRole(resolveActiveRole(eligible)));
      } catch {
        if (!cancelled) setRole('owner');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.roles, status]);

  if (status === 'loading' || !role) {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }

  return (
    <DashboardShell role={role}>
      <ProfileShell>{children}</ProfileShell>
    </DashboardShell>
  );
}
