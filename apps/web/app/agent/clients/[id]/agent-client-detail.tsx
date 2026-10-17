'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboard';
import { ApiErrorBanner, FormField, Input } from '@/components/forms';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  agencyClientKindLabel,
  archiveAgencyClient,
  getAgencyClient,
  updateAgencyClient,
  type PublicAgencyClient,
} from '@/lib/agent/clients';
import { ApiError } from '@/lib/api';
import {
  agentOrganizationIds,
  isAgencyGerant,
  listMyOrganizations,
} from '@/lib/me';
import { ROUTES } from '@/lib/routes';

export function AgentClientDetailPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const clientId = params.id;
  const router = useRouter();
  const { ready } = useRequireSession();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isGerant, setIsGerant] = useState(false);
  const [client, setClient] = useState<PublicAgencyClient | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const orgs = await listMyOrganizations();
        if (cancelled) return;
        setOrganizationId(agentOrganizationIds(orgs)[0] ?? null);
        setIsGerant(isAgencyGerant(orgs));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de charger votre agence.',
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  const load = useCallback(async () => {
    if (!organizationId || !clientId) return;
    setLoading(true);
    try {
      const row = await getAgencyClient(organizationId, clientId);
      setClient(row);
      setDisplayName(row.displayName);
      setEmail(row.email ?? '');
      setNote(row.internalNote ?? '');
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger ce client.',
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, clientId]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const handleSave = async () => {
    if (!organizationId || !clientId) return;
    setBusy(true);
    try {
      const updated = await updateAgencyClient(organizationId, clientId, {
        displayName: displayName.trim(),
        email: email.trim() || null,
        internalNote: note.trim() || null,
      });
      setClient(updated);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Enregistrement impossible.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async () => {
    if (!organizationId || !clientId) return;
    setBusy(true);
    try {
      await archiveAgencyClient(organizationId, clientId);
      router.push(ROUTES.agent.clients);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Archivage impossible.',
      );
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title={client?.displayName ?? 'Client'}
        description="Fiche CRM — distincte du mandat et de la propriété du bien."
        actions={
          <Link href={ROUTES.agent.clients}>
            <Button type="button" variant="secondary">
              Retour
            </Button>
          </Link>
        }
      />

      {error ? <ApiErrorBanner message={error} /> : null}

      {loading || !client ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <StatusBadge
            tone={client.hasAccount ? 'success' : 'warning'}
            label={agencyClientKindLabel(client)}
          />
          <p className="text-sm text-muted">
            Téléphone : {client.phoneE164 ?? '—'}
          </p>
          {isGerant && !client.archivedAt ? (
            <>
              <FormField name="displayName" label="Nom" required>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </FormField>
              <FormField name="email" label="E-mail">
                <Input
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
              <FormField name="note" label="Note interne">
                <Input
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleSave()}
                >
                  Enregistrer
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  disabled={busy}
                  onClick={() => void handleArchive()}
                >
                  Archiver
                </Button>
              </div>
            </>
          ) : (
            <>
              {client.email ? (
                <p className="text-sm text-muted">E-mail : {client.email}</p>
              ) : null}
              {client.internalNote ? (
                <p className="text-sm text-muted">Note : {client.internalNote}</p>
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
