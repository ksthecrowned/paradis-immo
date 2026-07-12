/** French long date + relative due labels for Locations portfolio. */

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseDay(isoDate: string): Date {
  // Accept YYYY-MM-DD or full ISO
  const day = isoDate.slice(0, 10);
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

export function formatDateFr(isoDate: string): string {
  const date = parseDay(isoDate);
  const raw = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  // "15 mai 2026" — ensure lowercase month (fr-FR usually already is)
  return raw.replace(/\u202f/g, ' ');
}

export function daysUntil(isoDate: string, now: Date = new Date()): number {
  const target = startOfLocalDay(parseDay(isoDate));
  const today = startOfLocalDay(now);
  const ms = target.getTime() - today.getTime();
  return Math.round(ms / 86_400_000);
}

export function formatRelativeDue(
  isoDate: string,
  now: Date = new Date(),
): string {
  const days = daysUntil(isoDate, now);
  if (days === 0) return 'aujourd’hui';
  if (days === 1) return 'demain';
  if (days === -1) return 'en retard de 1 jour';
  if (days < 0) return `en retard de ${Math.abs(days)} jours`;
  if (days >= 2 && days <= 6) return `dans ${days} jours`;
  if (days === 7) return 'dans 1 semaine';
  if (days >= 8 && days <= 13) return `dans ${days} jours`;
  const weeks = Math.round(days / 7);
  if (weeks === 1) return 'dans 1 semaine';
  return `dans ${weeks} semaines`;
}

export function formatDueLabel(
  isoDate: string,
  now: Date = new Date(),
): string {
  return `${formatDateFr(isoDate)} · ${formatRelativeDue(isoDate, now)}`;
}
