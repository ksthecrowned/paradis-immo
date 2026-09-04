import { MaintenanceTicketDetail } from '@/components/maintenance/maintenance-ticket-detail';

export default async function AgentMaintenanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.JSX.Element> {
  const { id } = await params;
  return <MaintenanceTicketDetail ticketId={id} role="agent" />;
}
