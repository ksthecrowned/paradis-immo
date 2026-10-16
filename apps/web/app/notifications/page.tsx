import { auth } from '@/auth';
import type { DashboardRole } from '@/components/dashboard/sidebar-nav';
import { notificationsPath } from '@/lib/notifications';
import { redirect } from 'next/navigation';

function pickRole(
  roles: string[] | undefined,
  orgRoles: string[] | undefined,
): DashboardRole {
  if ((roles ?? []).includes('PLATFORM_ADMIN')) return 'admin';
  const orgs = orgRoles ?? [];
  if (orgs.some((r) => r === 'AGENT' || r === 'ADMIN')) return 'agent';
  if (orgs.some((r) => r === 'OWNER')) return 'owner';
  return 'owner';
}

/** Deep-link target for web push notification clicks. */
export default async function NotificationsRedirectPage(): Promise<never> {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?callbackUrl=/notifications');
  }
  const user = session.user as {
    roles?: string[];
    orgRoles?: string[];
  };
  const role = pickRole(user.roles, user.orgRoles);
  redirect(notificationsPath(role));
}
