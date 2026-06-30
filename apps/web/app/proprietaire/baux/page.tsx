import { PlaceholderSection } from '@/app/proprietaire/_components/placeholder-section';

export default function OwnerBauxPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Baux"
      description="Baux actifs et historique des locations."
      apiReady={false}
    />
  );
}
