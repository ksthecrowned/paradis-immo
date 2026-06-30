import { PlaceholderSection } from '@/app/proprietaire/_components/placeholder-section';

export default function OwnerBienDetailPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Détail du bien"
      description="Aperçu, galerie, historique des paiements et des visites."
      apiReady={false}
    />
  );
}
