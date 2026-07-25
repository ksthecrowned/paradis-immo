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
      leaseHref={ROUTES.owner.lease}
      paymentHref={ROUTES.owner.payment}
      backHref={ROUTES.owner.tenants}
    />
  );
}
