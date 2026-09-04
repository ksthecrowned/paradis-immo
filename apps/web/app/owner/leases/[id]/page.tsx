import { LeaseDetail } from '@/components/leases/lease-detail';

export default async function OwnerLeaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <LeaseDetail leaseId={id} />;
}
