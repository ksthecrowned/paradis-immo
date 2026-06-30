import { PlaceholderSection } from '@/app/proprietaire/_components/placeholder-section';

export default function OwnerMandatPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Mon mandat"
      description="Statut du mandat de gestion signé avec Paradis Immo."
      apiReady={true}
    />
  );
}
