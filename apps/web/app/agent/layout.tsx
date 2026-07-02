'use client';

import { DashboardShell } from '@/components/dashboard';

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return <DashboardShell role="agent">{children}</DashboardShell>;
}
