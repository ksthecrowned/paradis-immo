'use client';

import { DashboardShell } from '@/components/dashboard';
import { AgencyStorefrontGate } from '@/components/dashboard/agency-storefront-gate';

export default function AgentLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <DashboardShell role="agent">
      <AgencyStorefrontGate>{children}</AgencyStorefrontGate>
    </DashboardShell>
  );
}
