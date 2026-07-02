import { PlaceholderSection } from '@/components/placeholder-section';

export default function AdminDashboardPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Tableau de bord admin"
      description="Supervision globale de la plateforme : utilisateurs, annonces et statistiques."
      apiReady={true}
    />
  );
}
