export interface RentScheduleInput {
  startDate: Date;
  endDate: Date;
  monthlyRent: string | number;
  currency: string;
  /** Flat or provisioned monthly charges added to the rent (spec 04). */
  chargesAmount?: string | number;
  /** Day of month the rent is due; defaults to the start day (spec 04). */
  dueDay?: number;
  /**
   * Deposit (caution). Called as a special schedule line due on the move-in
   * date (spec 04); `0` or omitted creates no deposit line.
   */
  deposit?: string | number;
}

export interface RentScheduleEntry {
  dueDate: Date;
  amount: string;
  currency: string;
  rentPart: string;
  chargesPart: string;
  periodStart: Date;
  periodEnd: Date;
  /** `DEPOSIT` for the deposit line, `RENT` for the monthly rents. */
  kind: 'RENT' | 'DEPOSIT';
}

/**
 * Pure: turn a lease term into N monthly rent entries (one per month boundary
 * from `startDate` to `endDate`, inclusive of the month containing
 * `endDate`), prefixed by the `DEPOSIT` line when a deposit is configured.
 * Used by the unit tests and by `LeasesService.performActivation()`.
 *
 * The first entry's `dueDate` is the lease `startDate`; subsequent entries
 * are the same day-of-month one month later. If the start day-of-month is
 * the 29-31, the JS Date will roll forward — that's acceptable for the MVP
 * (long-term leases are negotiated in person).
 */
export function generateRentSchedule(
  input: RentScheduleInput,
): RentScheduleEntry[] {
  const entries: RentScheduleEntry[] = [];
  if (input.endDate <= input.startDate) return entries;

  const rentPart = String(input.monthlyRent);
  const chargesPart = String(input.chargesAmount ?? 0);
  const total = formatAmount(Number(rentPart) + Number(chargesPart));
  const start = new Date(input.startDate);
  // Due day defaults to the start day-of-month and is clamped to the last day
  // of short months (dueDay is validated to 1-28 at the API boundary).
  const dueDay = input.dueDay ?? start.getUTCDate();

  // Spec 04 — the deposit is called as its own line, due on the move-in date.
  const deposit = Number(input.deposit ?? 0);
  if (deposit > 0) {
    entries.push({
      dueDate: new Date(start),
      amount: formatAmount(deposit),
      currency: input.currency,
      rentPart: '0',
      chargesPart: '0',
      periodStart: new Date(start),
      periodEnd: new Date(start),
      kind: 'DEPOSIT',
    });
  }

  // Every line falls on `dueDay` (default: the move-in day), clamped to the
  // last day of short months. The first month is prorated in amount by the
  // caller when needed (spec 04).
  const cursor = new Date(start);
  cursor.setUTCDate(Math.min(dueDay, daysInMonth(cursor)));

  while (true) {
    const due = new Date(cursor);
    const nextMonth = new Date(due);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const periodEnd = new Date(nextMonth);
    periodEnd.setUTCDate(0); // last day of the covered month
    entries.push({
      dueDate: due,
      amount: total,
      currency: input.currency,
      rentPart,
      chargesPart,
      periodStart: new Date(due),
      periodEnd,
      kind: 'RENT',
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    if (cursor > input.endDate) break;
  }

  return entries;
}

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function daysInMonth(d: Date): number {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
}
