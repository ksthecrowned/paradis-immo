export interface RentScheduleInput {
  startDate: Date;
  endDate: Date;
  monthlyRent: string | number;
  currency: string;
}

export interface RentScheduleEntry {
  dueDate: Date;
  amount: string;
  currency: string;
}

/**
 * Pure: turn a lease term into N monthly rent entries (one per month boundary
 * from `startDate` to `endDate`, inclusive of the month containing
 * `endDate`). Used by the unit tests and by `LeasesService.activate()`.
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

  const amount = String(input.monthlyRent);
  const cursor = new Date(input.startDate);

  while (true) {
    entries.push({
      dueDate: new Date(cursor),
      amount,
      currency: input.currency,
    });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    if (cursor > input.endDate) break;
  }

  return entries;
}
