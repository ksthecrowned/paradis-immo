'use client';

import { Button } from '@/components/primitives/Button';
import {
    bookingStatusLabel,
    bookingStatusTone,
    type PublicBooking,
} from '@/lib/bookings';
import { Icon } from '@iconify/react';
import { useMemo, useState } from 'react';
import { StatusBadge } from './data-table';

export type BookingSummary = PublicBooking & {
  /** Required for calendar display — bookings without dates are filtered out. */
  startDate: string;
  endDate: string;
};

export interface BookingsCalendarProps {
  bookings: BookingSummary[];
  loading?: boolean;
  /** Called when the user clicks "Annuler" on a PENDING/CONFIRMED booking. */
  onCancel?: (id: string) => void | Promise<void>;
  busyId?: string | null;
  /** Clic sur une barre ou un jour : ouvre un éventuel drawer de détail. */
  onBookingClick?: (id: string) => void;
}

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

const DATE_LABEL = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;

const LANE_HEIGHT = 24; // px
const LANE_TOP_OFFSET = 28; // px — number cell is 28px tall
const MAX_LANES = 3;
const ROW_HEIGHT = LANE_TOP_OFFSET + MAX_LANES * LANE_HEIGHT + 4; // px

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function diffDays(a: Date, b: Date): number {
  const ms = startOfDay(a).getTime() - startOfDay(b).getTime();
  return Math.round(ms / 86_400_000);
}

interface CalendarCell {
  date: Date;
  outside: boolean;
  isToday: boolean;
}

interface Week {
  key: string;
  days: CalendarCell[];
  /** First day (00:00) of the week, used to compute bar positions. */
  start: Date;
  /** Last day (00:00) of the week, used to compute bar positions. */
  end: Date;
  /** Bar segments to render on this week, grouped by lane. */
  lanes: LaneSegment[][];
  /** How many bookings overflowed past the visible MAX_LANES. */
  hiddenCount: number;
}

interface LaneSegment {
  bookingId: string;
  startCol: number;
  colSpan: number;
  status: string;
  startDate: string;
  endDate: string;
  truncatedStart: boolean;
  truncatedEnd: boolean;
  propertyId: string;
  userId: string;
  totalPrice: string;
  currency: string;
}

function buildWeeks(
  month: Date,
  bookings: BookingSummary[],
): Week[] {
  const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthIndex = firstOfMonth.getMonth();

  // Find the Monday on or before the 1st of the month.
  const weekdayOfFirst = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(firstOfMonth.getDate() - weekdayOfFirst);

  // 6 weeks cover any month layout.
  const todayKey = dayKey(new Date());
  const weeks: Week[] = [];
  for (let w = 0; w < 6; w++) {
    const weekStart = new Date(gridStart);
    weekStart.setDate(gridStart.getDate() + w * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const days: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(weekStart);
      cellDate.setDate(weekStart.getDate() + d);
      days.push({
        date: cellDate,
        outside: cellDate.getMonth() !== monthIndex,
        isToday: dayKey(cellDate) === todayKey,
      });
    }

    // Compute bars for this week.
    const active = bookings.filter((b) => {
      const start = startOfDay(new Date(b.startDate));
      const end = startOfDay(new Date(b.endDate));
      return start <= weekEnd && end >= weekStart;
    });

    // Sort by start ascending, then by end descending (longer first).
    active.sort((a, b) => {
      const aStart = startOfDay(new Date(a.startDate)).getTime();
      const bStart = startOfDay(new Date(b.startDate)).getTime();
      if (aStart !== bStart) return aStart - bStart;
      return (
        startOfDay(new Date(b.endDate)).getTime() -
        startOfDay(new Date(a.endDate)).getTime()
      );
    });

    const lanes: LaneSegment[][] = [];
    let hiddenCount = 0;
    for (const booking of active) {
      const bStart = startOfDay(new Date(booking.startDate));
      const bEnd = startOfDay(new Date(booking.endDate));

      const truncatedStart = bStart < weekStart;
      const truncatedEnd = bEnd > weekEnd;

      const visibleStart = bStart < weekStart ? weekStart : bStart;
      const visibleEnd = bEnd > weekEnd ? weekEnd : bEnd;
      const startCol = diffDays(visibleStart, weekStart);
      const endCol = diffDays(visibleEnd, weekStart);
      const colSpan = endCol - startCol + 1;

      // Find a free lane: lanes[i] holds the end-column of the last segment
      // in that lane; we want lanes[i] < startCol.
      let assignedLane = -1;
      for (let i = 0; i < MAX_LANES; i++) {
        const lane: LaneSegment[] = (lanes[i] ??= []);
        const last = lane[lane.length - 1];
        if (!last || startCol >= last.startCol + last.colSpan) {
          assignedLane = i;
          break;
        }
      }
      if (assignedLane === -1) {
        hiddenCount += 1;
        continue;
      }
      const segment: LaneSegment = {
        bookingId: booking.id,
        startCol,
        colSpan,
        status: booking.status,
        startDate: booking.startDate,
        endDate: booking.endDate,
        truncatedStart,
        truncatedEnd,
        propertyId: booking.propertyId,
        userId: booking.userId,
        totalPrice: booking.totalPrice,
        currency: booking.currency,
      };
      lanes[assignedLane].push(segment);
    }

    weeks.push({
      key: dayKey(weekStart),
      days,
      start: weekStart,
      end: weekEnd,
      lanes,
      hiddenCount,
    });
  }
  return weeks;
}

const STATUS_BAR: Record<string, string> = {
  PENDING:
    'bg-warning/85 text-white border border-warning hover:bg-warning',
  CONFIRMED: 'bg-accent text-white border border-accent hover:bg-accent-light',
  COMPLETED:
    'bg-accent/30 text-accent border border-accent/40 hover:bg-accent/40',
  CANCELLED:
    'bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 line-through',
};

function BookingBar({
  segment,
  onClick,
  title,
}: {
  segment: LaneSegment;
  onClick?: (id: string) => void;
  title: string;
}): React.JSX.Element {
  // Position computed from the week row's grid.
  // The week row is `grid-cols-7` so each cell is 1/7 ≈ 14.2857%.
  // Bars are inset by ~2px on each side (gap-px) — we approximate with %.
  const left = (segment.startCol / 7) * 100;
  const width = (segment.colSpan / 7) * 100;
  const baseClass = STATUS_BAR[segment.status] ?? STATUS_BAR.PENDING!;
  return (
    <button
      type="button"
      onClick={() => onClick?.(segment.bookingId)}
      title={title}
      className={`absolute top-0.5 flex h-5 items-center gap-1 truncate rounded-md px-2 text-[11px] font-medium transition-colors ${baseClass}`}
      style={{ left: `calc(${left}% + 2px)`, width: `calc(${width}% - 4px)` }}
    >
      {segment.truncatedStart ? (
        <Icon
          icon="solar:alt-arrow-left-linear"
          className="size-3 shrink-0 opacity-80"
        />
      ) : null}
      <span className="truncate">
        {segment.propertyId.slice(0, 6)}…
      </span>
      {segment.truncatedEnd ? (
        <Icon
          icon="solar:alt-arrow-right-linear"
          className="size-3 shrink-0 opacity-80"
        />
      ) : null}
    </button>
  );
}

function DayCell({
  cell,
  selected,
  onClick,
  hasBookings,
}: {
  cell: CalendarCell;
  selected: boolean;
  onClick: () => void;
  hasBookings: boolean;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'group relative flex h-7 items-start justify-end px-1.5 pt-1 text-xs transition-colors',
        'hover:bg-card-hover focus:outline-none focus:ring-1 focus:ring-accent/40',
        cell.outside ? 'text-muted/40' : 'text-foreground',
        cell.isToday ? 'bg-accent/5' : '',
        selected ? 'bg-accent/15!' : '',
      ].join(' ')}
    >
      <span
        className={[
          'inline-flex size-5 items-center justify-center rounded-full text-[11px] font-medium',
          cell.isToday
            ? 'bg-accent text-white'
            : hasBookings
              ? 'font-semibold'
              : '',
        ].join(' ')}
      >
        {cell.date.getDate()}
      </span>
    </button>
  );
}

export function BookingsCalendar({
  bookings,
  loading = false,
  onCancel,
  busyId = null,
  onBookingClick,
}: BookingsCalendarProps): React.JSX.Element {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [month, setMonth] = useState<Date>(today);
  const [selected, setSelected] = useState<Date>(today);

  const weeks = useMemo(() => buildWeeks(month, bookings), [month, bookings]);

  const totalThisMonth = useMemo(() => {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    let total = 0;
    for (const b of bookings) {
      const start = startOfDay(new Date(b.startDate));
      const end = startOfDay(new Date(b.endDate));
      if (start <= monthEnd && end >= monthStart) total += 1;
    }
    return total;
  }, [bookings, month]);

  const dayHasBookings = useMemo(() => {
    const set = new Set<string>();
    for (const b of bookings) {
      const start = startOfDay(new Date(b.startDate));
      const end = startOfDay(new Date(b.endDate));
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (
          d.getFullYear() === selected.getFullYear() &&
          d.getMonth() === selected.getMonth()
        ) {
          set.add(dayKey(d));
        }
      }
    }
    return set;
  }, [bookings, selected]);

  const selectedBookings = useMemo(() => {
    const sel = startOfDay(selected);
    return bookings
      .filter((b) => {
        const start = startOfDay(new Date(b.startDate));
        const end = startOfDay(new Date(b.endDate));
        return start <= sel && end >= sel;
      })
      .sort(
        (a, b) =>
          startOfDay(new Date(a.startDate)).getTime() -
          startOfDay(new Date(b.startDate)).getTime(),
      );
  }, [bookings, selected]);

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

  const selectedHasBookings = dayHasBookings.has(dayKey(selected));

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
              réservation{totalThisMonth > 1 ? 's' : ''} sur le mois
            </>
          )}
        </p>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border border-border bg-card shadow-sm">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-xs font-medium text-muted"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {loading ? (
          <div className="space-y-1 p-3" aria-hidden>
            {Array.from({ length: 6 }).map((_, w) => (
              <div
                key={w}
                className="grid grid-cols-7 gap-1"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                {Array.from({ length: 7 }).map((__, d) => (
                  <div
                    key={d}
                    className="h-7 animate-pulse rounded bg-card-hover/60"
                  />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div>
            {weeks.map((week) => (
              <div
                key={week.key}
                className="relative grid grid-cols-7 border-b border-border last:border-b-0"
                style={{ height: `${ROW_HEIGHT}px` }}
              >
                {/* Day cells (background) */}
                {week.days.map((cell) => (
                  <div
                    key={dayKey(cell.date)}
                    className="relative"
                    style={{ minHeight: '100%' }}
                  >
                    <DayCell
                      cell={cell}
                      selected={dayKey(cell.date) === dayKey(selected)}
                      onClick={() => setSelected(cell.date)}
                      hasBookings={week.lanes.some((lane) =>
                        lane.some((seg) => {
                          const visibleStart = new Date(week.start);
                          visibleStart.setDate(
                            week.start.getDate() + seg.startCol,
                          );
                          return dayKey(visibleStart) <= dayKey(cell.date) &&
                            dayKey(cell.date) <=
                              dayKey(
                                new Date(
                                  visibleStart.getTime() +
                                    (seg.colSpan - 1) * 86_400_000,
                                ),
                              );
                        }),
                      )}
                    />
                  </div>
                ))}
                {/* Bars overlay */}
                <div
                  className="pointer-events-none absolute inset-x-0"
                  style={{ top: `${LANE_TOP_OFFSET}px` }}
                >
                  {week.lanes.map((lane, laneIdx) => (
                    <div
                      key={laneIdx}
                      className="pointer-events-auto relative"
                      style={{ height: `${LANE_HEIGHT}px` }}
                    >
                      {lane.map((seg) => {
                        const startStr = DATE_LABEL.format(
                          new Date(seg.startDate),
                        );
                        const endStr = DATE_LABEL.format(
                          new Date(seg.endDate),
                        );
                        const statusLabel = bookingStatusLabel(seg.status);
                        return (
                          <BookingBar
                            key={seg.bookingId}
                            segment={seg}
                            onClick={onBookingClick}
                            title={`${startStr} → ${endStr} · ${statusLabel}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                  {week.hiddenCount > 0 ? (
                    <div
                      className="pointer-events-auto absolute right-1"
                      style={{ top: 0, height: `${LANE_HEIGHT}px` }}
                    >
                      <span className="inline-flex h-5 items-center rounded-md bg-muted/40 px-1.5 text-[10px] font-semibold text-muted">
                        +{week.hiddenCount}
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
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
              {selectedBookings.length === 0
                ? 'Aucune réservation'
                : `${selectedBookings.length} réservation${selectedBookings.length > 1 ? 's' : ''} active${selectedBookings.length > 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {!selectedHasBookings ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Icon
              icon="solar:calendar-mark-line-duotone"
              className="size-10 text-muted"
            />
            <p className="text-sm text-muted">
              Cliquez sur un jour du calendrier pour afficher ses réservations.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {selectedBookings.map((booking) => {
              const start = new Date(booking.startDate);
              const end = new Date(booking.endDate);
              const nights = Math.max(
                1,
                Math.round(
                  (startOfDay(end).getTime() - startOfDay(start).getTime()) /
                    86_400_000,
                ),
              );
              const amount = new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: booking.currency,
                maximumFractionDigits: 0,
              }).format(Number(booking.totalPrice));
              const cancellable =
                booking.status === 'PENDING' ||
                booking.status === 'CONFIRMED';
              return (
                <li
                  key={booking.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Icon
                      icon="solar:calendar-date-linear"
                      className="size-4 text-accent"
                    />
                    {DATE_LABEL.format(start)} → {DATE_LABEL.format(end)}
                    <span className="ml-1 text-xs font-normal text-muted">
                      · {nights} nuit{nights > 1 ? 's' : ''}
                    </span>
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
                    <span className="inline-flex items-center gap-1.5 text-muted">
                      <Icon
                        icon="solar:wallet-money-linear"
                        className="size-4"
                      />
                      <span className="font-mono text-xs">{amount}</span>
                    </span>
                  </div>
                  <StatusBadge
                    label={bookingStatusLabel(booking.status)}
                    tone={bookingStatusTone(booking.status)}
                  />
                  {cancellable && onCancel ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="solar:close-circle-linear"
                      loading={busyId === booking.id}
                      disabled={busyId === booking.id}
                      onClick={() => {
                        if (confirm('Annuler cette réservation ?')) {
                          void onCancel(booking.id);
                        }
                      }}
                    >
                      Annuler
                    </Button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
