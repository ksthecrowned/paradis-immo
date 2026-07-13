'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  assignMaintenanceTicket,
  getMaintenanceTicket,
  maintenancePriorityLabel,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  updateMaintenanceTicket,
  type PublicMaintenanceTicket,
} from '@/lib/owner/maintenance';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

const STATUS_OPTIONS = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'DONE',
  'CLOSED',
] as const;

export interface OwnerMaintenanceDetailProps {
  ticketId: string;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function OwnerMaintenanceDetail({
  ticketId,
}: OwnerMaintenanceDetailProps): React.JSX.Element {
  const { ready } = useRequireSession();
  const [ticket, setTicket] = useState<PublicMaintenanceTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMaintenanceTicket(ticketId);
      setTicket(data);
      setStatus(data.status);
      setEstimatedCost(data.estimatedCost ?? '');
      setAssigneeId(data.assigneeId ?? '');
      setError(null);
    } catch (err) {
      setTicket(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le ticket.',
      );
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleSaveStatusCost = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setBusy(true);
      try {
        const body: { status?: string; estimatedCost?: number } = {
          status,
        };
        if (estimatedCost.trim() !== '') {
          body.estimatedCost = Number(estimatedCost);
        }
        await updateMaintenanceTicket(ticketId, body);
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de mettre à jour le ticket.',
        );
      } finally {
        setBusy(false);
      }
    },
    [estimatedCost, load, status, ticketId],
  );

  const handleAssign = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!assigneeId.trim()) return;
      setBusy(true);
      try {
        await assignMaintenanceTicket(ticketId, assigneeId.trim());
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’assigner le ticket.',
        );
      } finally {
        setBusy(false);
      }
    },
    [assigneeId, load, ticketId],
  );

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  if (!ticket) {
    return (
      <section className="space-y-4">
        <DashboardPageHeader title="Ticket maintenance" />
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error ?? 'Ticket introuvable.'}
        </div>
        <Link
          href={ROUTES.owner.maintenance}
          className="inline-block text-sm text-accent hover:underline"
        >
          ← Retour à la maintenance
        </Link>
      </section>
    );
  }

  const shortId = `${ticket.id.slice(0, 8)}…`;

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={ticket.title}
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Maintenance', href: ROUTES.owner.maintenance },
          { label: shortId },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={maintenanceStatusLabel(ticket.status)}
              tone={maintenanceStatusTone(ticket.status)}
            />
            <Link
              href={ROUTES.owner.maintenance}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
            >
              Liste
            </Link>
          </div>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      {ticket.requiresOwnerApproval ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-foreground">
          Ce ticket nécessite une approbation propriétaire (réparation
          urgente / coût élevé).
        </div>
      ) : null}

      <div className="grid gap-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Bien
          </p>
          <Link
            href={ROUTES.owner.property(ticket.propertyId)}
            className="mt-1 inline-block font-mono text-sm text-accent hover:underline"
          >
            {ticket.propertyId}
          </Link>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Signaleur
          </p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {ticket.reporterId}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Priorité
          </p>
          <p className="mt-1 text-sm text-foreground">
            {maintenancePriorityLabel(ticket.priority)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Créé
          </p>
          <p className="mt-1 text-sm text-foreground">
            {formatDate(ticket.createdAt)}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Description
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">
            {ticket.description}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => void handleSaveStatusCost(e)}
        className="space-y-4 rounded-md border border-border bg-card p-5"
      >
        <h2 className="text-base font-semibold text-heading">
          Statut et coût
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Statut</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {maintenanceStatusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">
              Coût estimé (XAF)
            </span>
            <input
              type="number"
              min={0}
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
              placeholder="Optionnel"
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </form>

      <form
        onSubmit={(e) => void handleAssign(e)}
        className="space-y-4 rounded-md border border-border bg-card p-5"
      >
        <h2 className="text-base font-semibold text-heading">Assignation</h2>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">
            Technicien / agent (ID utilisateur)
          </span>
          <input
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            required
            placeholder="UUID du compte"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={busy || !assigneeId.trim()}
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
        >
          Assigner
        </button>
      </form>
    </section>
  );
}
