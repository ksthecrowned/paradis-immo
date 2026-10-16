'use client';

import { AgencyStorefrontForm } from '@/components/dashboard/agency-storefront-form';
import { DashboardPageHeader } from '@/components/dashboard';
import { useRequireSession } from '@/hooks/use-require-session';

export function AgencyStorefrontPage(): React.JSX.Element {
  const { ready } = useRequireSession();

  if (!ready) {
    return (
      <div role="status" className="text-sm text-muted">
        Chargement…
      </div>
    );
  }

  return (
    <div className="w-full space-y-5">
      <DashboardPageHeader
        title="Configurer la vitrine de l’agence"
        description="Complétez les informations publiques de votre agence pour la rendre visible dans l’annuaire Paradis Immo."
      />
      <AgencyStorefrontForm submitLabel="Enregistrer" />
    </div>
  );
}
