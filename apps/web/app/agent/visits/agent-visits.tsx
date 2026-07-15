'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DashboardPageHeader,
  VisitsCalendar,
  type VisitBookingSummary,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import { ApiError } from '@/lib/api';
import {
  cancelVisit,
  confirmVisit,
  listManagedVisits,
  type PublicVisitBooking,
} from '@/lib/agent/visits';
import { useRequireSession } from '@/hooks/use-require-session';

export function AgentVisitsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [bookings, setBookings] = useState<VisitBookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedVisits();
      setBookings(
        data
          .filter(
            (b): b is PublicVisitBooking & { slotStartAt: string; slotEndAt: string } =>
              typeof b.slotStartAt === 'string' &&
              typeof b.slotEndAt === 'string',
          )
          .map((b) => ({
            ...b,
            slotStartAt: b.slotStartAt,
            slotEndAt: b.slotEndAt,
          })),
      );
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les visites.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleConfirm = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await confirmVisit(id);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de confirmer la visite.',
        );
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const handleCancel = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        await cancelVisit(id);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible d'annuler la visite.",
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
        title="Visites"
        actions={
          <Button
            variant="primary"
            icon="solar:calendar-add-linear"
            onClick={() => {
              // TODO: ouvrir le drawer de création d'une visite.
            }}
          >
            Ajouter une visite
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <VisitsCalendar
        bookings={bookings}
        loading={loading}
        onConfirm={(id) => void handleConfirm(id)}
        onCancel={(id) => void handleCancel(id)}
        busyId={busyId}
      />
    </section>
  );
}
