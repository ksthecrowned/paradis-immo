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
import { getProperty, type PublicProperty } from '@/lib/owner/properties';
import {
  blockSlot,
  createTemplate,
  DAY_LABELS,
  deactivateTemplate,
  listAvailableSlots,
  listTemplates,
  slotStatusLabel,
  type PublicVisitSlot,
  type PublicVisitSlotTemplate,
} from '@/lib/owner/visit-slots';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

function normalizeTime(value: string): string {
  return value.slice(0, 5);
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function slotTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'AVAILABLE') return 'success';
  if (status === 'BOOKED') return 'warning';
  if (status === 'BLOCKED') return 'danger';
  return 'neutral';
}

export interface OwnerVisitSlotsProps {
  propertyId: string;
}

export function OwnerVisitSlots({
  propertyId,
}: OwnerVisitSlotsProps): React.JSX.Element {
  const { ready } = useRequireSession();
  const [property, setProperty] = useState<PublicProperty | null>(null);
  const [templates, setTemplates] = useState<PublicVisitSlotTemplate[]>([]);
  const [slots, setSlots] = useState<PublicVisitSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blocking, setBlocking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prop = await getProperty(propertyId);
      setProperty(prop);

      if (!prop.visitEnabled) {
        setTemplates([]);
        setSlots([]);
        setError(null);
        return;
      }

      const from = new Date().toISOString();
      const [tmpl, upcoming] = await Promise.all([
        listTemplates(propertyId),
        listAvailableSlots(propertyId, from),
      ]);
      setTemplates(tmpl);
      setSlots(upcoming);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les créneaux.',
      );
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleCreate = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        await createTemplate(propertyId, {
          dayOfWeek,
          startTime: normalizeTime(startTime),
          endTime: normalizeTime(endTime),
          slotMinutes,
        });
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de créer le modèle.',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [dayOfWeek, endTime, load, propertyId, slotMinutes, startTime],
  );

  const handleDeactivate = useCallback(
    async (templateId: string) => {
      if (!confirm('Désactiver ce modèle de créneau ?')) return;
      setActionId(templateId);
      try {
        await deactivateTemplate(templateId);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de désactiver le modèle.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const handleBlock = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!blockStart || !blockEnd) return;
      setBlocking(true);
      try {
        await blockSlot(
          propertyId,
          new Date(blockStart).toISOString(),
          new Date(blockEnd).toISOString(),
        );
        setBlockStart('');
        setBlockEnd('');
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de bloquer ce créneau.',
        );
      } finally {
        setBlocking(false);
      }
    },
    [blockEnd, blockStart, load, propertyId],
  );

  const templateColumns = useMemo<ListColumn<PublicVisitSlotTemplate>[]>(
    () => [
      {
        key: 'dayOfWeek',
        label: 'Jour',
        sortable: true,
        render: (value) => DAY_LABELS[Number(value)] ?? String(value),
      },
      {
        key: 'startTime',
        label: 'Début',
        sortable: true,
      },
      {
        key: 'endTime',
        label: 'Fin',
        sortable: true,
      },
      {
        key: 'slotMinutes',
        label: 'Durée (min)',
        sortable: true,
      },
      {
        key: 'active',
        label: 'Statut',
        sortable: true,
        render: (value) => (
          <StatusBadge
            label={value ? 'Actif' : 'Inactif'}
            tone={value ? 'success' : 'neutral'}
          />
        ),
      },
    ],
    [],
  );

  const slotColumns = useMemo<ListColumn<PublicVisitSlot>[]>(
    () => [
      {
        key: 'startAt',
        label: 'Début',
        sortable: true,
        render: (value) => formatDateTime(String(value)),
      },
      {
        key: 'endAt',
        label: 'Fin',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) => formatDateTime(String(value)),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'AVAILABLE', label: 'Disponible' },
          { value: 'BOOKED', label: 'Réservé' },
          { value: 'BLOCKED', label: 'Bloqué' },
        ],
        render: (value) => (
          <StatusBadge
            label={slotStatusLabel(String(value))}
            tone={slotTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  if (!property) {
    return (
      <section className="space-y-4">
        <DashboardPageHeader title="Créneaux de visite" />
        <p className="text-sm text-danger" role="alert">
          {error ?? 'Bien introuvable.'}
        </p>
      </section>
    );
  }

  if (!property.visitEnabled) {
    return (
      <section className="space-y-4">
        <DashboardPageHeader
          title="Créneaux de visite"
          actions={
            <Link
              href={ROUTES.owner.property(propertyId)}
              className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
            >
              Retour au bien
            </Link>
          }
        />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted">
          Les visites ne sont pas activées pour ce bien. Activez-les depuis la
          fiche du bien pour configurer des créneaux.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-8">
      <DashboardPageHeader
        title="Créneaux de visite"
        actions={
          <Link
            href={ROUTES.owner.property(propertyId)}
            className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
          >
            Retour au bien
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-heading">
          Modèles hebdomadaires
        </h2>
        <ListDataTable
          data={templates}
          columns={templateColumns}
          loading={false}
          onRefresh={load}
          entityLabel="modèles"
          searchPlaceholder="Rechercher un modèle…"
          emptyMessage="Aucun modèle configuré."
          tableId="owner-visit-templates"
          actions={(row) =>
            row.active ? (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleDeactivate(row.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-hover disabled:opacity-50"
              >
                Désactiver
              </button>
            ) : null
          }
        />
      </section>

      <section className="rounded-md border border-border bg-card p-5">
        <h2 className="mb-4 text-base font-semibold text-heading">
          Ajouter un modèle
        </h2>
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Jour</span>
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              {DAY_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Heure début</span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Heure fin</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Durée créneau (min)</span>
            <input
              type="number"
              min={15}
              max={120}
              step={15}
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
            >
              {submitting ? 'Ajout…' : 'Ajouter'}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-md border border-border bg-card p-5">
        <h2 className="mb-4 text-base font-semibold text-heading">
          Bloquer une plage horaire
        </h2>
        <form
          onSubmit={(e) => void handleBlock(e)}
          className="grid gap-4 sm:grid-cols-3"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Début</span>
            <input
              type="datetime-local"
              value={blockStart}
              onChange={(e) => setBlockStart(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Fin</span>
            <input
              type="datetime-local"
              value={blockEnd}
              onChange={(e) => setBlockEnd(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={blocking}
              className="w-full rounded-lg border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
            >
              {blocking ? 'Blocage…' : 'Bloquer'}
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-heading">
          Créneaux à venir
        </h2>
        <ListDataTable
          data={slots}
          columns={slotColumns}
          loading={false}
          onRefresh={load}
          entityLabel="créneaux"
          searchPlaceholder="Rechercher un créneau…"
          emptyMessage="Aucun créneau généré pour le moment."
          tableId="owner-visit-slots"
        />
      </section>
    </section>
  );
}
