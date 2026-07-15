'use client';

import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
    listMyProperties,
    propertyCoverUrl,
    propertyTypeIcon,
    type PublicProperty,
} from '@/lib/owner/properties';
import {
    listManagedSlots,
    type PublicVisitSlot,
} from '@/lib/owner/visit-slots';
import { ROUTES } from '@/lib/routes';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface PropertyWithStats {
  property: PublicProperty;
  slots: PublicVisitSlot[];
}

const HORIZON_DAYS = 30;

function buildHorizon(): { from: string; to: string } {
  const from = new Date();
  const to = new Date();
  to.setDate(to.getDate() + HORIZON_DAYS);
  return { from: from.toISOString(), to: to.toISOString() };
}

function StatsRow({
  available,
  booked,
  blocked,
}: {
  available: number;
  booked: number;
  blocked: number;
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-3 gap-3 text-center">
      <div className="rounded-md border border-success/20 bg-success/5 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-success">
          Dispo
        </p>
        <p className="mt-0.5 text-lg font-semibold text-foreground">
          {available}
        </p>
      </div>
      <div className="rounded-md border border-accent/20 bg-accent/5 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-accent">
          Réservés
        </p>
        <p className="mt-0.5 text-lg font-semibold text-foreground">
          {booked}
        </p>
      </div>
      <div className="rounded-md border border-danger/20 bg-danger/5 px-3 py-2">
        <p className="text-[10px] font-medium uppercase tracking-wider text-danger">
          Bloqués
        </p>
        <p className="mt-0.5 text-lg font-semibold text-foreground">
          {blocked}
        </p>
      </div>
    </div>
  );
}

function PropertyCard({
  data,
}: {
  data: PropertyWithStats;
}): React.JSX.Element {
  const { property, slots } = data;
  const cover = propertyCoverUrl(property);
  const available = slots.filter((s) => s.status === 'AVAILABLE').length;
  const booked = slots.filter((s) => s.status === 'BOOKED').length;
  const blocked = slots.filter((s) => s.status === 'BLOCKED').length;
  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 p-4">
        {cover ? (
          <Image
            src={cover}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-md object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-14 shrink-0 items-center justify-center rounded-md bg-accent-muted text-accent"
          >
            <Icon icon={propertyTypeIcon(property.type)} className="size-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Link
            href={ROUTES.owner.property(property.id)}
            className="block truncate text-sm font-semibold text-foreground hover:text-accent"
          >
            {property.title}
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted">
            {property.quartier.name} · {property.quartier.arrondissement.city.name}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge
              label={property.visitType === 'PAID' ? 'Payante' : 'Gratuite'}
              tone={property.visitType === 'PAID' ? 'warning' : 'success'}
            />
            {property.visitDuration ? (
              <span className="text-[11px] text-muted">
                · {property.visitDuration} min
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="border-t border-border px-4 py-3">
        <StatsRow available={available} booked={booked} blocked={blocked} />
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
        <p className="text-xs text-muted">
          Sur les {HORIZON_DAYS} prochains jours
        </p>
        <Link href={ROUTES.owner.visitSlots(property.id)}>
          <Button
            variant="primary"
            size="sm"
            icon="solar:calendar-mark-linear"
          >
            Configurer
          </Button>
        </Link>
      </div>
    </article>
  );
}

export function OwnerVisitSlotsIndexPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PropertyWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const properties = await listMyProperties();
      const visitable = properties.filter((p) => p.visitEnabled);
      const { from, to } = buildHorizon();
      const detailed = await Promise.all(
        visitable.map(async (property) => {
          try {
            const slots = await listManagedSlots(property.id, from, to);
            return { property, slots };
          } catch {
            // On failure for a single property, show the card with 0 slots
            // instead of breaking the whole index.
            return { property, slots: [] };
          }
        }),
      );
      setRows(detailed);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger vos biens.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const totals = useMemo(() => {
    let available = 0;
    let booked = 0;
    let blocked = 0;
    for (const r of rows) {
      available += r.slots.filter((s) => s.status === 'AVAILABLE').length;
      booked += r.slots.filter((s) => s.status === 'BOOKED').length;
      blocked += r.slots.filter((s) => s.status === 'BLOCKED').length;
    }
    return { available, booked, blocked };
  }, [rows]);

  if (!ready) {
    return (
      <p className="text-sm text-muted">Chargement de la session…</p>
    );
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Créneaux de visite" />

      {error ? (
        <div className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-lg border border-border bg-card"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-md border border-dashed border-border bg-card py-14 text-center">
          <Icon
            icon="solar:calendar-minus-linear"
            className="size-12 text-muted"
          />
          <div>
            <p className="text-base font-semibold text-foreground">
              Aucun bien avec des visites activées
            </p>
            <p className="mt-1 text-sm text-muted">
              Activez les visites sur un de vos biens pour pouvoir ouvrir des créneaux.
            </p>
          </div>
          <Link href={ROUTES.owner.properties}>
            <Button variant="primary" icon="solar:home-2-linear">
              Voir mes biens
            </Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Icon icon="solar:calendar-mark-linear" className="size-4" />
            <span>
              {rows.length} bien{rows.length > 1 ? 's' : ''} avec visites
              activées ·{' '}
              <span className="font-semibold text-foreground">
                {totals.available}
              </span>{' '}
              dispo ·{' '}
              <span className="font-semibold text-foreground">
                {totals.booked}
              </span>{' '}
              réservés ·{' '}
              <span className="font-semibold text-foreground">
                {totals.blocked}
              </span>{' '}
              bloqués
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((data) => (
              <PropertyCard key={data.property.id} data={data} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
