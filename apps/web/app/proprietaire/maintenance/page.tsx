import { PlaceholderSection } from '@/app/proprietaire/_components/placeholder-section';

export default function OwnerMaintenancePage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Maintenance"
      description="Tickets de maintenance ouverts sur vos biens."
      apiReady={true}
    />
  );
}
