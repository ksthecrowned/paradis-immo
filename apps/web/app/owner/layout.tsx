'use client';

import { DashboardShell } from '@/components/dashboard';

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <DashboardShell role="owner">{children}</DashboardShell>;
}
