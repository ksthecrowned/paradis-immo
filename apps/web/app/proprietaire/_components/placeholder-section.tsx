/**
 * PlaceholderSection — squelette de page "à venir".
 *
 * Utilisé par toutes les pages propriétaire qui ne sont pas
 * encore câblées côté UI (Task 25 = squelette + dashboard).
 * L'API existe déjà pour la plupart ; il ne manque que la
 * page elle-même. Cette vue le dit honnêtement.
 */
export function PlaceholderSection({
  title,
  description,
  apiReady = true,
}: {
  title: string;
  description: string;
  /** Indique si l'API backend est déjà disponible. */
  apiReady?: boolean;
}): React.JSX.Element {
  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          {title}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
          {description}
        </p>
      </header>
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
        <p className="font-medium text-gray-800 dark:text-neutral-100">
          Page à venir
        </p>
        <p className="mt-2">
          Cette section est en cours de conception. {apiReady
            ? 'Les endpoints API sont déjà disponibles côté backend — la page sera branchée dans une prochaine itération.'
            : 'Elle sera livrée en même temps que l’endpoint API correspondant.'}
        </p>
      </div>
    </section>
  );
}
