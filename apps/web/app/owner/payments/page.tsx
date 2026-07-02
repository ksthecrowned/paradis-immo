import { PlaceholderSection } from '@/app/owner/_components/placeholder-section';

export default function OwnerPaiementsPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Paiements"
      description="Loyers perçus, en attente et en retard."
      apiReady={true}
    />
  );
}
