'use client';

import { TenantDetailPage } from '@/components/tenants/tenant-detail-page';
import { ROUTES } from '@/lib/routes';
import { useParams } from 'next/navigation';

export default function Page(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const tenantId = String(params.id ?? '');
  return (
    <TenantDetailPage
      tenantId={tenantId}
      leaseHref={() => ROUTES.agent.leases}
      backHref={ROUTES.agent.tenants}
    />
  );
}
