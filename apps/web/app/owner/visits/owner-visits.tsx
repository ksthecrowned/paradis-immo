'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  VisitsCalendar,
  type VisitBookingSummary,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import {
  PhoneInput,
  getPhoneE164,
  isPhoneComplete,
} from '@/components/forms';
import { ApiError } from '@/lib/api';
import {
  bookVisit,
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
import {
  DEFAULT_PHONE_COUNTRY,
  type PhoneCountrySelection,
} from '@/lib/phone';
import { useRequireSession } from '@/hooks/use-require-session';

export function OwnerVisitsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [bookings, setBookings] = useState<VisitBookingSummary[]>([]);
  const [slots, setSlots] = useState<PublicVisitSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [propertyId, setPropertyId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [phoneNational, setPhoneNational] = useState('');
  const [guestName, setGuestName] = useState('');
  const [phoneCountry, setPhoneCountry] =
    useState<PhoneCountrySelection>(DEFAULT_PHONE_COUNTRY);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedVisits();
      setBookings(
        data
          .filter(
            (b): b is PublicVisitBooking & {
              slotStartAt: string;
              slotEndAt: string;
            } =>
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

  const loadSlots = useCallback(async () => {
    try {
      const props = await listMyProperties();
      setProperties(
        props
          .filter((p) => p.visitEnabled)
          .map((p) => ({ id: p.id, title: p.title })),
      );
      const visitable = props.filter((p) => p.visitEnabled);
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
      setSlots([]);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
    void loadSlots();
  }, [load, loadSlots, ready]);

  const availableSlots = useMemo(
    () =>
      slots.filter(
        (s) =>
          s.status === 'AVAILABLE' &&
          (!propertyId || s.propertyId === propertyId),
      ),
    [slots, propertyId],
  );

  const handleCreate = async (): Promise<void> => {
    setCreating(true);
    setError(null);
    try {
      if (!propertyId || !slotId) {
        setError('Choisissez un bien et un créneau.');
        return;
      }
      if (!isPhoneComplete(phoneNational, phoneCountry)) {
        setError('Numéro du visiteur invalide.');
        return;
      }
      const name = guestName.trim();
      if (!name || name.length < 2) {
        setError('Indiquez le nom du visiteur.');
        return;
      }
      const guestPhone = getPhoneE164(phoneNational, phoneCountry);
      if (!guestPhone) {
        setError('Numéro du visiteur invalide.');
        return;
      }
      await bookVisit({ propertyId, slotId, guestPhone, guestName: name });
      setShowCreate(false);
      setSlotId('');
      setPhoneNational('');
      setGuestName('');
      await load();
      await loadSlots();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de créer la visite.',
      );
    } finally {
      setCreating(false);
    }
  };

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
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Demandes de visite"
        actions={
          <Button
            variant="primary"
            icon="solar:calendar-add-linear"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Fermer' : 'Ajouter une visite'}
          </Button>
        }
      />

      {error ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {showCreate ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-heading">
            Réserver pour un visiteur
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Bien</span>
              <select
                value={propertyId}
                onChange={(e) => {
                  setPropertyId(e.target.value);
                  setSlotId('');
                }}
                className="w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm"
              >
                <option value="">Sélectionner…</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Créneau disponible</span>
              <select
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
                className="w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm"
              >
                <option value="">Sélectionner…</option>
                {availableSlots.map((s) => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.startAt).toLocaleString('fr-FR')}
                  </option>
                ))}
              </select>
            </label>
            <div className="sm:col-span-2">
              <PhoneInput
                label="Téléphone du visiteur"
                required
                value={phoneNational}
                country={phoneCountry}
                onCountryChange={setPhoneCountry}
                onChange={setPhoneNational}
              />
              <p className="mt-1 text-xs text-muted">
                Compte existant ou non : un profil sera créé si besoin.
              </p>
            </div>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted">Nom du visiteur</span>
              <input
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                required
                minLength={2}
                placeholder="Prénom et nom"
                className="w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm"
              />
            </label>
          </div>
          <Button
            variant="primary"
            loading={creating}
            onClick={() => void handleCreate()}
          >
            Créer la visite
          </Button>
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
