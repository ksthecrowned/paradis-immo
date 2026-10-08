'use client';

import { ApplicationsBoard } from '@/components/applications/applications-board';
import { useRequireSession } from '@/hooks/use-require-session';
import { getProperty } from '@/lib/owner/properties';
import { useEffect, useState } from 'react';

/**
 * Client wrapper that resolves the property title for the page header, then
 * renders the candidature board. The title is cosmetic: a failure here must
 * not hide the board.
 */
export function ApplicationsBoardPage({
  propertyId,
  scope,
}: {
  propertyId: string;
  scope: 'owner' | 'agent';
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [title, setTitle] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void getProperty(propertyId)
      .then((property) => {
        if (!cancelled) setTitle(property.title);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return <ApplicationsBoard propertyId={propertyId} propertyTitle={title} />;
}