'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  createMaintenanceTicket,
  listManagedMaintenance,
  maintenancePriorityLabel,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  type PublicMaintenanceTicket,
} from '@/lib/owner/maintenance';
import { listMyProperties } from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function OwnerMaintenancePage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicMaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyId, setPropertyId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>(
    'MEDIUM',
  );
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedMaintenance();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger la maintenance.',
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
        const props = await listMyProperties();
        setProperties(props.map((p) => ({ id: p.id, title: p.title })));
        if (props[0]) setPropertyId(props[0].id);
      } catch {
        // ignore — user can still type property id manually
      }
    })();
  }, [load, ready]);

  const handleCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        await createMaintenanceTicket({
          propertyId: propertyId.trim(),
          title: title.trim(),
          description: description.trim(),
          priority,
        });
        setTitle('');
        setDescription('');
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de créer le ticket.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [description, load, priority, propertyId, title],
  );

  const columns = useMemo<ListColumn<PublicMaintenanceTicket>[]>(
    () => [
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'title',
        label: 'Titre',
        sortable: true,
      },
      {
        key: 'propertyId',
        label: 'Bien',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) => (
          <span className="font-mono text-xs text-muted">{String(value).slice(0, 8)}…</span>
        ),
      },
      {
        key: 'priority',
        label: 'Priorité',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'LOW', label: 'Basse' },
          { value: 'MEDIUM', label: 'Moyenne' },
          { value: 'HIGH', label: 'Haute' },
          { value: 'URGENT', label: 'Urgente' },
        ],
        render: (value) => maintenancePriorityLabel(String(value)),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'OPEN', label: 'Ouvert' },
          { value: 'ASSIGNED', label: 'Assigné' },
          { value: 'IN_PROGRESS', label: 'En cours' },
          { value: 'DONE', label: 'Terminé' },
          { value: 'CLOSED', label: 'Fermé' },
        ],
        render: (value) => (
          <StatusBadge
            label={maintenanceStatusLabel(String(value))}
            tone={maintenanceStatusTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Maintenance" />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={(e) => void handleCreate(e)}
        className="space-y-4 rounded-md border border-border bg-card p-5"
      >
        <h2 className="text-base font-semibold text-heading">
          Ouvrir un ticket
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
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
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Titre</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Priorité</span>
            <select
              value={priority}
              onChange={(e) =>
                setPriority(e.target.value as typeof priority)
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="LOW">Basse</option>
              <option value="MEDIUM">Moyenne</option>
              <option value="HIGH">Haute</option>
              <option value="URGENT">Urgente</option>
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {submitting ? 'Création…' : 'Créer le ticket'}
        </button>
      </form>

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        onRefresh={load}
        entityLabel="tickets"
        searchPlaceholder="Rechercher un ticket…"
        emptyMessage="Aucun ticket de maintenance."
        tableId="owner-maintenance-table"
        actions={(row) => (
          <Link
            href={ROUTES.owner.maintenanceTicket(row.id)}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
          >
            Voir
          </Link>
        )}
      />
    </section>
  );
}
