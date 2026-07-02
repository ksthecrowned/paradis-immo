'use client';

import { DashboardShell } from '@/components/dashboard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <DashboardShell role="admin">{children}</DashboardShell>;
}
