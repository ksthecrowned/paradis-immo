import { PlaceholderSection } from '@/components/placeholder-section';

export default function AgentPaymentsValidationPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Validation des paiements"
      description="File d'attente des paiements en espèces à valider après encaissement."
      apiReady={true}
    />
  );
}
