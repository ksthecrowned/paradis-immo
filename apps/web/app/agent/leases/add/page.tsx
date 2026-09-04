import { LeaseForm } from '@/components/leases/lease-form';

export default function AgentLeaseAddPage(): React.JSX.Element {
  return <LeaseForm role="agent" submitLabel="Créer le bail" />;
}
