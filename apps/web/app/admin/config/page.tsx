import { PlaceholderSection } from '@/components/placeholder-section';

export default function AdminConfigPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Configuration"
      description="Paramètres pays, devises et prestataires de paiement actifs."
      apiReady={false}
    />
  );
}
