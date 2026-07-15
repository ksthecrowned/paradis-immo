import { OwnerMaintenanceEditForm } from '../../owner-maintenance-edit-form';

export default async function OwnerMaintenanceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <OwnerMaintenanceEditForm ticketId={id} />;
}
