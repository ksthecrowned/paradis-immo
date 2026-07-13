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
  listManagedSlots,
  listTemplates,
  openSlot,
  slotStatusLabel,
  unblockSlot,
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

  const [openStart, setOpenStart] = useState('');
  const [openMinutes, setOpenMinutes] = useState(30);
  const [opening, setOpening] = useState(false);

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
        listManagedSlots(propertyId, from),
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

  const handleOpen = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!openStart) return;
      setOpening(true);
      try {
        const startAt = new Date(openStart);
        const endAt = new Date(startAt.getTime() + openMinutes * 60_000);
        await openSlot(propertyId, {
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
        });
        setOpenStart('');
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’ouvrir le créneau.',
        );
      } finally {
        setOpening(false);
      }
    },
    [load, openMinutes, openStart, propertyId],
  );

  const handleBlockRow = useCallback(
    async (slot: PublicVisitSlot) => {
      setActionId(slot.id);
      try {
        await blockSlot(propertyId, slot.startAt, slot.endAt);
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de bloquer le créneau.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load, propertyId],
  );

  const handleUnblockRow = useCallback(
    async (slot: PublicVisitSlot) => {
      setActionId(slot.id);
      try {
        await unblockSlot(slot.id);
        await load();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de débloquer le créneau.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

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
        setError(null);
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
        setError(null);
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
        setError(null);
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
    <section className="space-y-10">
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
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-heading">
          Ouvrir un créneau
        </h2>
        <p className="text-sm text-muted">
          Choisissez une date et une durée pour proposer une visite.
        </p>
        <form
          onSubmit={(e) => void handleOpen(e)}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Début</span>
            <input
              type="datetime-local"
              required
              value={openStart}
              onChange={(e) => setOpenStart(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 sm:w-auto"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Durée (min)</span>
            <input
              type="number"
              min={15}
              step={15}
              value={openMinutes}
              onChange={(e) => setOpenMinutes(Number(e.target.value) || 30)}
              className="w-28 rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={opening}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {opening ? 'Ouverture…' : 'Ouvrir'}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-heading">À venir</h2>
        <ListDataTable
          data={slots}
          columns={slotColumns}
          loading={false}
          onRefresh={load}
          entityLabel="créneaux"
          searchPlaceholder="Rechercher un créneau…"
          emptyMessage="Aucun créneau à venir."
          tableId="owner-visit-slots"
          actions={(row) => {
            if (row.status === 'AVAILABLE') {
              return (
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={() => void handleBlockRow(row)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-card-hover disabled:opacity-50"
                >
                  Bloquer
                </button>
              );
            }
            if (row.status === 'BLOCKED') {
              return (
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={() => void handleUnblockRow(row)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-card-hover disabled:opacity-50"
                >
                  Débloquer
                </button>
              );
            }
            return null;
          }}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium text-muted">Bloquer une plage</h2>
        <form
          onSubmit={(e) => void handleBlock(e)}
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
        >
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Début</span>
            <input
              type="datetime-local"
              value={blockStart}
              onChange={(e) => setBlockStart(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 sm:w-auto"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Fin</span>
            <input
              type="datetime-local"
              value={blockEnd}
              onChange={(e) => setBlockEnd(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2 sm:w-auto"
            />
          </label>
          <button
            type="submit"
            disabled={blocking}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            {blocking ? 'Blocage…' : 'Bloquer'}
          </button>
        </form>
      </section>

      <details className="space-y-4 pt-2">
        <summary className="cursor-pointer text-sm font-medium text-muted">
          Modèles hebdomadaires
        </summary>
        <div className="space-y-4 pt-2">
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
              <span className="mb-1 block text-muted">Durée (min)</span>
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
                className="w-full rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-card-hover disabled:opacity-50"
              >
                {submitting ? 'Ajout…' : 'Ajouter le modèle'}
              </button>
            </div>
          </form>
        </div>
      </details>
    </section>
  );
}
