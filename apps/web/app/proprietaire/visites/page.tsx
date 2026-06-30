import { PlaceholderSection } from '@/app/proprietaire/_components/placeholder-section';

export default function OwnerVisitesPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Demandes de visite"
      description="Demandes de visite émises par les prospects sur vos biens."
      apiReady={true}
    />
  );
}
