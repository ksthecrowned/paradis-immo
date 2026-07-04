'use client';

import { DashboardPageHeader } from '@/components/dashboard';

export function PlaceholderSection({
  title,
  description,
  apiReady = true,
}: {
  title: string;
  description: string;
  apiReady?: boolean;
}): React.JSX.Element {
  return (
    <section className="space-y-4">
      <DashboardPageHeader title={title} />
      <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-muted">
        <p className="font-medium text-foreground">{description}</p>
        <p className="mt-2">
          {apiReady
            ? 'Les endpoints API sont disponibles — cette page sera branchée prochainement.'
            : 'Cette section sera livrée avec l’endpoint API correspondant.'}
        </p>
      </div>
    </section>
  );
}
