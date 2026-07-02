import { PlaceholderSection } from '@/app/owner/_components/placeholder-section';

export default function OwnerNouveauBienPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Ajouter un bien"
      description="Formulaire de création d’un nouveau bien (location ou vente)."
      apiReady={true}
    />
  );
}
