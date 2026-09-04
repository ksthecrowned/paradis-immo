import { PropertyForm } from '@/components/properties/property-form';

export default function AgentNouveauBienPage(): React.JSX.Element {
  return (
    <PropertyForm
      variant="agent"
      submitLabel="Enregistrer pour le propriétaire"
    />
  );
}
