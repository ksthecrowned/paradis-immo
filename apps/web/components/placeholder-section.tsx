/**
 * PlaceholderSection — squelette de page "à venir".
 */
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
      <header>
        <h1 className="text-2xl font-semibold text-dash-text">{title}</h1>
        <p className="mt-1 text-sm text-dash-text-muted">{description}</p>
      </header>
      <div className="rounded-xl border border-dashed border-dash-border bg-dash-card p-6 text-sm text-dash-text-muted">
        <p className="font-medium text-dash-text">Page à venir</p>
        <p className="mt-2">
          Cette section est en cours de conception.{' '}
          {apiReady
            ? 'Les endpoints API sont déjà disponibles côté backend — la page sera branchée dans une prochaine itération.'
            : 'Elle sera livrée en même temps que l’endpoint API correspondant.'}
        </p>
      </div>
    </section>
  );
}
