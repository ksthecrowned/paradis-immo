'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  approvalStatusLabel,
  createMandate,
  decideApproval,
  listPendingApprovals,
  mandateActionLabel,
  type PublicMandateApproval,
} from '@/lib/owner/mandates';
import { listMyProperties } from '@/lib/owner/properties';
import { listMyOrganizations } from '@/lib/me';
import { useRequireSession } from '@/hooks/use-require-session';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function payloadSummary(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof payload.propertyId === 'string') {
    parts.push(`Bien ${payload.propertyId.slice(0, 8)}…`);
  }
  if (typeof payload.amount === 'string' || typeof payload.amount === 'number') {
    parts.push(`Montant ${payload.amount}`);
  }
  if (typeof payload.title === 'string') {
    parts.push(payload.title);
  }
  return parts.length > 0 ? parts.join(' · ') : JSON.stringify(payload);
}

export function OwnerMandatePage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [approvals, setApprovals] = useState<PublicMandateApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [organizations, setOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [creating, setCreating] = useState(false);
  const [mandateCreated, setMandateCreated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPendingApprovals();
      setApprovals(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les approbations.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
    void (async () => {
      try {
        const [props, orgs] = await Promise.all([
          listMyProperties(),
          listMyOrganizations(),
        ]);
        setProperties(props.map((p) => ({ id: p.id, title: p.title })));
        setOrganizations(orgs.map((o) => ({ id: o.id, name: o.name })));
        if (props[0]) setPropertyId(props[0].id);
        if (orgs[0]) setOrganizationId(orgs[0].id);
      } catch {
        // optional prefill
      }
    })();
  }, [load, ready]);

  const handleCreateMandate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setCreating(true);
      setMandateCreated(false);
      setError(null);
      try {
        await createMandate({
          propertyId: propertyId.trim(),
          organizationId: organizationId.trim(),
        });
        setMandateCreated(true);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de créer le mandat.',
        );
      } finally {
        setCreating(false);
      }
    },
    [organizationId, propertyId],
  );

  const handleDecide = useCallback(
    async (id: string, approve: boolean) => {
      const label = approve ? 'approuver' : 'rejeter';
      if (!confirm(`Confirmer : ${label} cette demande ?`)) return;
      setActionId(id);
      try {
        await decideApproval(id, approve);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : `Impossible de ${label} la demande.`,
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Mon mandat" />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted">
        Déléguez la gestion d’un bien à une agence, puis validez ici les
        actions qui nécessitent votre accord.
      </div>

      {mandateCreated ? (
        <div className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-foreground">
          Mandat créé avec succès.
        </div>
      ) : null}

      <form
        onSubmit={(e) => void handleCreateMandate(e)}
        className="space-y-4 rounded-md border border-border bg-card p-5"
      >
        <h2 className="text-base font-semibold text-heading">
          Déléguer un bien
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Bien</span>
            <select
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Agence</span>
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              {organizations.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {creating ? 'Création…' : 'Créer le mandat'}
        </button>
      </form>

      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : approvals.length === 0 ? (
        <p className="text-sm text-muted">Aucune approbation en attente.</p>
      ) : (
        <ul className="space-y-4">
          {approvals.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-heading">
                      {mandateActionLabel(item.actionType)}
                    </h2>
                    <StatusBadge
                      label={approvalStatusLabel(item.status)}
                      tone={item.status === 'PENDING' ? 'warning' : 'neutral'}
                    />
                  </div>
                  <p className="text-sm text-muted">
                    {payloadSummary(item.payload)}
                  </p>
                  <p className="text-xs text-muted">
                    Demandé le {formatDate(item.createdAt)}
                  </p>
                </div>
                {item.status === 'PENDING' ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={actionId === item.id}
                      onClick={() => void handleDecide(item.id, true)}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                    >
                      Approuver
                    </button>
                    <button
                      type="button"
                      disabled={actionId === item.id}
                      onClick={() => void handleDecide(item.id, false)}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-card-hover disabled:opacity-50"
                    >
                      Rejeter
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
