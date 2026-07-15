'use client';

import { Button } from '@/components/primitives/Button';
import type { PublicVisitSlot } from '@/lib/owner/visit-slots';
import {
    visitStatusLabel,
    visitStatusTone,
    type PublicVisitBooking,
} from '@/lib/visits';
import { Icon } from '@iconify/react';
import { useMemo, useState } from 'react';
import { DayPicker, type DayButtonProps } from 'react-day-picker';
import { fr } from 'react-day-picker/locale';
import { StatusBadge } from './data-table';

export type VisitBookingSummary = PublicVisitBooking & {
  /** Required for calendar display — bookings without a slot are filtered out. */
  slotStartAt: string;
  slotEndAt: string;
};

export interface VisitsCalendarProps {
  /** All bookings to display. Bookings without `slotStartAt` are ignored. */
  bookings: VisitBookingSummary[];
  /**
   * Optional open slots (AVAILABLE / BLOCKED) to surface on the calendar as a
   * discreet "X dispo" badge — lets the owner see at a glance which days still
   * have open visit windows even when no RDV is yet booked.
   */
  slots?: PublicVisitSlot[];
  loading?: boolean;
  /** Called when the user clicks "Confirmer" on a PENDING booking. */
  onConfirm?: (id: string) => void | Promise<void>;
  /** Called when the user clicks "Annuler" on a booking. */
  onCancel?: (id: string) => void | Promise<void>;
  /** Id currently being mutated — disables the matching action button. */
  busyId?: string | null;
  /** Optional: called when the user clicks an empty day to create a new visit. */
  onDayCreate?: (date: Date) => void;
}

type DayMarker =
  | { tone: 'pending'; count: number }
  | { tone: 'confirmed'; count: number }
  | { tone: 'cancelled'; count: number };

const MONTH_LABEL = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

const DAY_LONG_LABEL = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const TIME_LABEL = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
});

/** YYYY-MM-DD key in the user's local timezone (avoid UTC shifts). */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Decide the dominant marker color for a day's bookings. */
function markerFor(bookings: VisitBookingSummary[]): DayMarker | null {
  if (bookings.length === 0) return null;
  // Priority: pending > confirmed > cancelled (visually warn the user first).
  const pending = bookings.filter((b) => b.status === 'PENDING').length;
  if (pending > 0) return { tone: 'pending', count: pending };
  const confirmed = bookings.filter((b) => b.status === 'CONFIRMED').length;
  if (confirmed > 0) return { tone: 'confirmed', count: confirmed };
  return { tone: 'cancelled', count: bookings.length };
}

const MARKER_CLASS: Record<DayMarker['tone'], string> = {
  pending: 'bg-warning text-white',
  confirmed: 'bg-accent text-white',
  cancelled: 'bg-danger/60 text-white',
};

const MARKER_DOT_CLASS: Record<DayMarker['tone'], string> = {
  pending: 'bg-warning',
  confirmed: 'bg-accent',
  cancelled: 'bg-danger/60',
};

function VisitsDayButton({
  dayBookings,
  daySlots,
  ...props
}: DayButtonProps & {
  dayBookings: VisitBookingSummary[];
  daySlots: PublicVisitSlot[];
}) {
  const marker = markerFor(dayBookings);
  const isOutside = props.modifiers.outside;
  const isToday = props.modifiers.today;
  const isSelected = props.modifiers.selected;
  const availableSlotCount = daySlots.filter(
    (s) => s.status === 'AVAILABLE',
  ).length;
  const hasMarker = Boolean(marker);
  return (
    <button
      {...props}
      type="button"
      className={[
        'relative flex size-10 items-center justify-center rounded-md text-sm transition-colors',
        'hover:bg-card-hover focus:outline-none focus:ring-2 focus:ring-accent/40',
        isOutside ? 'text-muted/40' : 'text-foreground',
        isToday ? 'ring-1 ring-accent/40' : '',
        isSelected ? '!bg-accent-muted !text-accent font-semibold' : '',
        'disabled:pointer-events-none disabled:opacity-50',
      ].join(' ')}
    >
      <span>{props.day.date.getDate()}</span>
      {hasMarker ? (
        marker!.count === 1 ? (
          <span
            aria-hidden
            className={`absolute right-1 top-1 size-1.5 rounded-full ${MARKER_DOT_CLASS[marker!.tone]}`}
          />
        ) : (
          <span
            aria-hidden
            className={`absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-bold ${MARKER_CLASS[marker!.tone]}`}
          >
            {marker!.count}
          </span>
        )
      ) : null}
      {availableSlotCount > 0 ? (
        <span
          aria-label={`${availableSlotCount} créneau${availableSlotCount > 1 ? 'x' : ''} disponible${availableSlotCount > 1 ? 's' : ''}`}
          className="absolute bottom-0.5 left-0.5 inline-flex items-center gap-0.5 rounded bg-success/15 px-1 text-[10px] font-semibold leading-tight text-success"
        >
          <Icon icon="solar:clock-circle-linear" className="size-2.5" />
          {availableSlotCount}
        </span>
      ) : null}
    </button>
  );
}

export function VisitsCalendar({
  bookings,
  slots = [],
  loading = false,
  onConfirm,
  onCancel,
  busyId = null,
  onDayCreate,
}: VisitsCalendarProps): React.JSX.Element {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [month, setMonth] = useState<Date>(today);
  const [selected, setSelected] = useState<Date>(today);

  // Index bookings by day (local timezone) for O(1) lookup.
  const byDay = useMemo(() => {
    const map = new Map<string, VisitBookingSummary[]>();
    for (const booking of bookings) {
      if (!booking.slotStartAt) continue;
      const d = new Date(booking.slotStartAt);
      const key = dayKey(d);
      const list = map.get(key);
      if (list) list.push(booking);
      else map.set(key, [booking]);
    }
    // Sort each day's list by start time for stable display.
    for (const list of map.values()) {
      list.sort((a, b) =>
        new Date(a.slotStartAt).getTime() - new Date(b.slotStartAt).getTime(),
      );
    }
    return map;
  }, [bookings]);

  // Index slots by day. A slot counts on the day its `startAt` falls on
  // (slots are short windows — typically 30/60 min — so they don't span days).
  const slotsByDay = useMemo(() => {
    const map = new Map<string, PublicVisitSlot[]>();
    for (const slot of slots) {
      if (!slot.startAt) continue;
      const d = new Date(slot.startAt);
      const key = dayKey(d);
      const list = map.get(key);
      if (list) list.push(slot);
      else map.set(key, [slot]);
    }
    return map;
  }, [slots]);

  const selectedKey = dayKey(selected);
  const dayBookings = byDay.get(selectedKey) ?? [];

  const totalThisMonth = useMemo(() => {
    // Sum bookings whose date falls in the currently displayed month.
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    let total = 0;
    for (const [key, list] of byDay) {
      if (key.startsWith(monthKey)) total += list.length;
    }
    return total;
  }, [byDay, month]);

  const openSlotsThisMonth = useMemo(() => {
    if (slots.length === 0) return 0;
    const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    let total = 0;
    for (const [key, list] of slotsByDay) {
      if (key.startsWith(monthKey)) {
        total += list.filter((s) => s.status === 'AVAILABLE').length;
      }
    }
    return total;
  }, [slotsByDay, month, slots.length]);

  const goPrev = (): void => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  };
  const goNext = (): void => {
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  };
  const goToday = (): void => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    setMonth(now);
    setSelected(now);
  };

  return (
    <div className="space-y-6">
      {/* Header — month nav + today + total count */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Mois précédent"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-card-hover"
          >
            <Icon icon="solar:alt-arrow-left-linear" className="size-4" />
          </button>
          <span className="min-w-[170px] text-center text-base font-semibold capitalize text-foreground">
            {MONTH_LABEL.format(month)}
          </span>
          <button
            type="button"
            onClick={goNext}
            aria-label="Mois suivant"
            className="inline-flex size-9 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-card-hover"
          >
            <Icon icon="solar:alt-arrow-right-linear" className="size-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-2 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-card-hover"
          >
            <Icon icon="solar:calendar-linear" className="size-4" />
            Aujourd'hui
          </button>
        </div>
        <p className="text-sm text-muted">
          {loading ? (
            <span className="inline-block h-4 w-24 animate-pulse rounded bg-card-hover" />
          ) : (
            <>
              <span className="font-semibold text-foreground">
                {totalThisMonth}
              </span>{' '}
              visite{totalThisMonth > 1 ? 's' : ''} sur le mois
              {openSlotsThisMonth > 0 ? (
                <>
                  {' · '}
                  <span className="font-semibold text-success">
                    {openSlotsThisMonth}
                  </span>{' '}
                  créneau{openSlotsThisMonth > 1 ? 'x' : ''} ouvert
                  {openSlotsThisMonth > 1 ? 's' : ''}
                </>
              ) : null}
            </>
          )}
        </p>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        {loading ? (
          <div className="grid grid-cols-7 gap-1.5" aria-hidden>
            {Array.from({ length: 42 }).map((_, i) => (
              <div
                key={i}
                className="size-10 animate-pulse rounded-md bg-card-hover/60"
              />
            ))}
          </div>
        ) : (
          <DayPicker
            month={month}
            onMonthChange={setMonth}
            mode="single"
            selected={selected}
            onSelect={(d) => {
              if (!d) return;
              setSelected(d);
            }}
            onDayClick={(d, modifiers) => {
              // Click on an empty day (no RDV) → allow opening the create drawer.
              if (onDayCreate && modifiers.day && (byDay.get(dayKey(d)) ?? []).length === 0) {
                onDayCreate(d);
              }
            }}
            locale={fr}
            showOutsideDays
            weekStartsOn={1}
            classNames={{
              root: 'rdp-root w-full text-sm',
              months: 'w-full',
              month: 'w-full',
              month_caption: 'hidden',
              month_grid: 'w-full border-collapse',
              weekdays: 'text-xs text-muted',
              weekday: 'py-2 font-medium',
              week: '',
              day: 'p-0',
            }}
            components={{
              DayButton: (props) => (
                <VisitsDayButton
                  {...props}
                  dayBookings={byDay.get(dayKey(props.day.date)) ?? []}
                  daySlots={slotsByDay.get(dayKey(props.day.date)) ?? []}
                />
              ),
            }}
          />
        )}
      </div>

      {/* Day detail panel */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h3 className="text-base font-semibold capitalize text-heading">
              {DAY_LONG_LABEL.format(selected)}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              {dayBookings.length === 0
                ? 'Aucune visite programmée'
                : `${dayBookings.length} visite${dayBookings.length > 1 ? 's' : ''} programmée${dayBookings.length > 1 ? 's' : ''}`}
            </p>
          </div>
          {onDayCreate ? (
            <Button
              variant="primary"
              size="sm"
              icon="solar:calendar-add-linear"
              onClick={() => onDayCreate(selected)}
            >
              Ajouter
            </Button>
          ) : null}
        </div>

        {dayBookings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon
              icon="solar:calendar-mark-line-duotone"
              className="size-10 text-muted"
            />
            <p className="text-sm text-muted">
              Cliquez sur un jour du calendrier pour afficher ses visites.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {dayBookings.map((booking) => {
              const start = new Date(booking.slotStartAt);
              const end = new Date(booking.slotEndAt);
              const isPending = booking.status === 'PENDING';
              const isCancelled = booking.status === 'CANCELLED';
              return (
                <li
                  key={booking.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Icon
                      icon="solar:clock-circle-linear"
                      className="size-4 text-accent"
                    />
                    {TIME_LABEL.format(start)} → {TIME_LABEL.format(end)}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Icon icon="solar:home-2-linear" className="size-4" />
                      <span className="font-mono text-xs">
                        {booking.propertyId.slice(0, 8)}…
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Icon icon="solar:user-linear" className="size-4" />
                      <span className="font-mono text-xs">
                        {booking.userId.slice(0, 8)}…
                      </span>
                    </span>
                  </div>
                  <StatusBadge
                    label={visitStatusLabel(booking.status)}
                    tone={visitStatusTone(booking.status)}
                  />
                  <div className="flex items-center gap-1.5">
                    {isPending && onConfirm ? (
                      <Button
                        variant="primary"
                        size="sm"
                        icon="solar:check-circle-linear"
                        loading={busyId === booking.id}
                        disabled={busyId === booking.id}
                        onClick={() => void onConfirm(booking.id)}
                      >
                        Confirmer
                      </Button>
                    ) : null}
                    {!isCancelled && onCancel ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon="solar:close-circle-linear"
                        loading={busyId === booking.id}
                        disabled={busyId === booking.id}
                        onClick={() => {
                          if (confirm('Annuler cette visite ?')) {
                            void onCancel(booking.id);
                          }
                        }}
                      >
                        Annuler
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
