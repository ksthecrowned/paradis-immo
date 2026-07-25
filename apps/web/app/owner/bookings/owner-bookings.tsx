'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DashboardPageHeader,
  BookingsCalendar,
  type BookingSummary,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import {
  PhoneInput,
  getPhoneE164,
  isPhoneComplete,
} from '@/components/forms';
import { ApiError } from '@/lib/api';
import {
  cancelBooking,
  createBooking,
  listManagedBookings,
  type PublicBooking,
} from '@/lib/bookings';
import { listMyProperties } from '@/lib/owner/properties';
import {
  DEFAULT_PHONE_COUNTRY,
  type PhoneCountrySelection,
} from '@/lib/phone';
import { useRequireSession } from '@/hooks/use-require-session';

export function OwnerBookingsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [bookings, setBookings] = useState<BookingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [propertyId, setPropertyId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [phoneNational, setPhoneNational] = useState('');
  const [guestName, setGuestName] = useState('');
  const [phoneCountry, setPhoneCountry] =
    useState<PhoneCountrySelection>(DEFAULT_PHONE_COUNTRY);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedBookings();
      setBookings(
        data
          .filter(
            (b): b is PublicBooking & { startDate: string; endDate: string } =>
              typeof b.startDate === 'string' && typeof b.endDate === 'string',
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
    void listMyProperties()
      .then((rows) =>
        setProperties(
          rows
            .filter((p) => p.mode === 'RENT_SHORT')
            .map((p) => ({ id: p.id, title: p.title })),
        ),
      )
      .catch(() => setProperties([]));
  }, [load, ready]);

  const handleCreate = async (): Promise<void> => {
    setCreating(true);
    setError(null);
    try {
      if (!propertyId || !startDate || !endDate) {
        setError('Bien et dates obligatoires.');
        return;
      }
      if (!isPhoneComplete(phoneNational, phoneCountry)) {
        setError('Numéro du voyageur invalide.');
        return;
      }
      const name = guestName.trim();
      if (!name || name.length < 2) {
        setError('Indiquez le nom du voyageur.');
        return;
      }
      const guestPhone = getPhoneE164(phoneNational, phoneCountry);
      if (!guestPhone) {
        setError('Numéro du voyageur invalide.');
        return;
      }
      await createBooking({
        propertyId,
        startDate,
        endDate,
        guestPhone,
        guestName: name,
      });
      setShowCreate(false);
      setPhoneNational('');
      setGuestName('');
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de créer la réservation.',
      );
    } finally {
      setCreating(false);
    }
  };

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
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Réservations"
        actions={
          <Button
            variant="primary"
            icon="solar:calendar-add-linear"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Fermer' : 'Ajouter une réservation'}
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
            Réserver pour un voyageur
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-muted">Bien (court séjour)</span>
              <select
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
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
              <span className="mb-1 block text-muted">Arrivée</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-muted">Départ</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-input-border bg-search px-3 py-2.5 text-sm"
              />
            </label>
            <div className="sm:col-span-2">
              <PhoneInput
                label="Téléphone du voyageur"
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
              <span className="mb-1 block text-muted">Nom du voyageur</span>
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
            Créer la réservation
          </Button>
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
