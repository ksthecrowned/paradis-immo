'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  bookingStatusLabel,
  bookingStatusTone,
  cancelBooking,
  listManagedBookings,
  type PublicBooking,
} from '@/lib/bookings';
import { useRequireSession } from '@/hooks/use-require-session';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function BookingsTable({
  title,
  tableId,
}: {
  title: string;
  tableId: string;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedBookings();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les réservations.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleCancel = useCallback(
    async (id: string) => {
      if (!confirm('Annuler cette réservation ?')) return;
      setActionId(id);
      try {
        await cancelBooking(id);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d\'annuler la réservation.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const columns = useMemo<ListColumn<PublicBooking>[]>(
    () => [
      {
        key: 'startDate',
        label: 'Arrivée',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'endDate',
        label: 'Départ',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'propertyId',
        label: 'Bien',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-muted">{String(value).slice(0, 8)}…</span>
        ),
      },
      {
        key: 'totalPrice',
        label: 'Montant',
        sortable: true,
        render: (value, row) => formatMoney(String(value), row.currency),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'PENDING', label: 'En attente' },
          { value: 'CONFIRMED', label: 'Confirmée' },
          { value: 'CANCELLED', label: 'Annulée' },
          { value: 'COMPLETED', label: 'Terminée' },
        ],
        render: (value) => (
          <StatusBadge
            label={bookingStatusLabel(String(value))}
            tone={bookingStatusTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title={title} />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-base text-danger">
          {error}
        </div>
      ) : null}

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        onRefresh={load}
        entityLabel="réservations"
        searchPlaceholder="Rechercher une réservation…"
        emptyMessage="Aucune réservation."
        tableId={tableId}
        actions={(row) =>
          row.status === 'PENDING' || row.status === 'CONFIRMED' ? (
            <button
              type="button"
              disabled={actionId === row.id}
              onClick={() => void handleCancel(row.id)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-hover disabled:opacity-50"
            >
              Annuler
            </button>
          ) : null
        }
      />
    </section>
  );
}

export function OwnerBookingsPage(): React.JSX.Element {
  return <BookingsTable title="Réservations" tableId="owner-bookings-table" />;
}
