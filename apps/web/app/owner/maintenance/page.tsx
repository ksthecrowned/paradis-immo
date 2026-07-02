import { PlaceholderSection } from '@/app/owner/_components/placeholder-section';

export default function OwnerMaintenancePage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Maintenance"
      description="Tickets de maintenance ouverts sur vos biens."
      apiReady={true}
    />
  );
}
