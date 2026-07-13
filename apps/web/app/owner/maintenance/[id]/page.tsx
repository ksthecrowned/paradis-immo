import { OwnerMaintenanceDetail } from './owner-maintenance-detail';

export default async function OwnerMaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <OwnerMaintenanceDetail ticketId={id} />;
}
