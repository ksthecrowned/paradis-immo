'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DashboardPageHeader,
  BookingsCalendar,
  type BookingSummary,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import { ApiError } from '@/lib/api';
import {
  cancelBooking,
  listManagedBookings,
  type PublicBooking,
} from '@/lib/agent/bookings';
import { useRequireSession } from '@/hooks/use-require-session';

export function AgentBookingsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedBookings();
      setBookings(
        data
          .filter(
            (b): b is PublicBooking & { startDate: string; endDate: string } =>
              typeof b.startDate === 'string' &&
              typeof b.endDate === 'string',
          )
          .map((b) => ({
            ...b,
            startDate: b.startDate,
            endDate: b.endDate,
          })),
      );
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
      setBusyId(id);
      try {
        await cancelBooking(id);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible d'annuler la réservation.",
        );
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  if (!ready) {
    return (
      <p className="text-sm text-muted">Chargement de la session…</p>
    );
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Réservations"
        actions={
          <Button
            variant="primary"
            icon="solar:calendar-add-linear"
            onClick={() => {
              // TODO: ouvrir le drawer de création d'une réservation.
            }}
          >
            Ajouter une réservation
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <BookingsCalendar
        bookings={bookings}
        loading={loading}
        onCancel={(id) => void handleCancel(id)}
        busyId={busyId}
      />
    </section>
  );
}
