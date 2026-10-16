'use client';

import { useRequireSession } from '@/hooks/use-require-session';
import { listMyOrganizations } from '@/lib/me';
import { ROUTES } from '@/lib/routes';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const STOREFRONT_ROUTE = ROUTES.agent.storefront;

export function AgencyStorefrontGate({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const [retry, setRetry] = useState(0);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(false);
  const [verified, setVerified] = useState(false);
  const previousPath = useRef<string | null>(null);
  const isStorefrontPage = pathname === STOREFRONT_ROUTE;

  useEffect(() => {
    const returnedFromStorefront =
      previousPath.current === STOREFRONT_ROUTE && !isStorefrontPage;
    previousPath.current = pathname;
    if (
      !ready ||
      isStorefrontPage ||
      (verified && !returnedFromStorefront)
    ) {
      return;
    }
    let cancelled = false;
    void Promise.resolve().then(async () => {
      setChecking(true);
      setError(false);
      try {
        const organizations = await listMyOrganizations();
        if (cancelled) return;
        setVerified(true);
        const incomplete = organizations.some(
          (organization) =>
            organization.type === 'AGENCY' &&
            organization.memberRole === 'ADMIN' &&
            !organization.shortName?.trim(),
        );
        if (incomplete && pathname !== STOREFRONT_ROUTE) {
          router.replace(STOREFRONT_ROUTE);
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isStorefrontPage, pathname, ready, retry, router, verified]);

  if (isStorefrontPage || (!checking && !error)) return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-72 max-w-xl items-center justify-center">
      <div className="w-full rounded-2xl border border-border bg-card p-6 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold text-heading">
              Vérification impossible
            </h1>
            <p className="mt-2 text-sm text-muted">
              Nous n’avons pas pu vérifier la configuration de votre vitrine.
              Réessayez pour accéder à votre espace.
            </p>
            <button
              type="button"
              onClick={() => setRetry((value) => value + 1)}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
            >
              Réessayer
            </button>
          </>
        ) : (
          <p role="status" className="text-sm text-muted">
            Vérification de la vitrine de votre agence…
          </p>
        )}
      </div>
    </div>
  );
}
