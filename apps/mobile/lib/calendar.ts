/** Calendar helpers — ISO dates as YYYY-MM-DD (local). */

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDays(key: string, days: number): string {
  const d = parseDayKey(key);
  d.setDate(d.getDate() + days);
  return toDayKey(d);
}

export function todayKey(now: Date = new Date()): string {
  return toDayKey(now);
}

export function startOfMonth(key: string): Date {
  const d = parseDayKey(key);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function shiftMonth(monthKey: string, delta: number): string {
  const d = parseDayKey(monthKey.length === 7 ? `${monthKey}-01` : monthKey);
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  return toDayKey(d);
}

export function monthTitleFr(monthKey: string): string {
  const d = startOfMonth(monthKey);
  const raw = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(d);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Monday-first grid: leading nulls + days of month. */
export function monthGrid(monthKey: string): Array<string | null> {
  const first = startOfMonth(monthKey);
  const year = first.getFullYear();
  const month = first.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // JS: Sun=0 … Sat=6 → Mon-first index 0
  const mondayIndex = (first.getDay() + 6) % 7;
  const cells: Array<string | null> = [];
  for (let i = 0; i < mondayIndex; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toDayKey(new Date(year, month, day)));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function isInRange(
  day: string,
  start?: string,
  end?: string,
): boolean {
  if (!start || !end) return false;
  return day > start && day < end;
}

export function formatDayLongFr(key: string): string {
  return parseDayKey(key).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export const WEEKDAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
