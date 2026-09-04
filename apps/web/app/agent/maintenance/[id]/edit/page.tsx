import { MaintenanceTicketEditForm } from '@/components/maintenance/maintenance-ticket-edit-form';

export default async function AgentMaintenanceEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <MaintenanceTicketEditForm ticketId={id} role="agent" />;
}
