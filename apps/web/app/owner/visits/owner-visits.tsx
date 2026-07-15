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
} from '@/lib/visits';
import { listMyProperties } from '@/lib/owner/properties';
import {
  listManagedSlots,
  type PublicVisitSlot,
} from '@/lib/owner/visit-slots';
import { useRequireSession } from '@/hooks/use-require-session';

export function OwnerVisitsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [bookings, setBookings] = useState<VisitBookingSummary[]>([]);
  const [slots, setSlots] = useState<PublicVisitSlot[]>([]);
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

  // Aggregate open visit slots across all properties with `visitEnabled=true`
  // so the calendar can surface "X créneaux dispo" markers even on days
  // without any RDV booked. Per-property failures are swallowed — a single
  // bad property must not break the whole calendar.
  const loadSlots = useCallback(async () => {
    try {
      const properties = await listMyProperties();
      const visitable = properties.filter((p) => p.visitEnabled);
      if (visitable.length === 0) {
        setSlots([]);
        return;
      }
      const from = new Date().toISOString();
      const all = (
        await Promise.all(
          visitable.map((p) =>
            listManagedSlots(p.id, from).catch(() => [] as PublicVisitSlot[]),
          ),
        )
      ).flat();
      setSlots(all);
    } catch {
      // Non-blocking: if we can't load slots, the calendar still works
      // for the booking dots — we just lose the "X dispo" markers.
      setSlots([]);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
    void loadSlots();
  }, [load, loadSlots, ready]);

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
        title="Demandes de visite"
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
        slots={slots}
        loading={loading}
        onConfirm={(id) => void handleConfirm(id)}
        onCancel={(id) => void handleCancel(id)}
        busyId={busyId}
      />
    </section>
  );
}
