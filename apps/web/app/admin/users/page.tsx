import { PlaceholderSection } from '@/components/placeholder-section';

export default function AdminUsersPage(): React.JSX.Element {
  return (
    <PlaceholderSection
      title="Utilisateurs"
      description="Liste des comptes, rôles et organisations inscrites sur Paradis Immo."
      apiReady={true}
    />
  );
}
