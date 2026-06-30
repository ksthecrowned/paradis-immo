import { PlaceholderSection } from '@/app/proprietaire/_components/placeholder-section';

export default function OwnerBiensPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Mes biens"
      description="Liste de tous les biens que vous avez publiés sur Paradis Immo."
      apiReady={false}
    />
  );
}
