import type { PublicPayment } from '@/lib/owner/payments';
import type { PropertyMode, PublicProperty } from '@/lib/owner/properties';

export type ChartRangeKey = '1m' | '6m' | '1y';

export interface RevenueSeriesPoint {
  categories: string[];
  revenue: number[];
  paymentCounts: number[];
}

export interface PropertyModeSeries {
  series: [number, number, number];
  rows: Array<{
    name: string;
    count: number;
    percent: string;
  }>;
}

const MODE_ORDER: PropertyMode[] = ['RENT_SHORT', 'RENT_LONG', 'SALE'];
const MODE_LABELS: Record<PropertyMode, string> = {
  RENT_SHORT: 'Location courte',
  RENT_LONG: 'Location longue',
  SALE: 'Vente',
};

const MONTH_SHORT = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

function isValidated(p: PublicPayment): boolean {
  return p.status === 'VALIDATED' || p.status === 'PAID';
}

function amountOf(p: PublicPayment): number {
  const n = Number(p.amount);
  return Number.isFinite(n) ? n : 0;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weekKey(d: Date): string {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const dayNum = (day.getDay() + 6) % 7; // Mon=0
  day.setDate(day.getDate() - dayNum);
  return day.toISOString().slice(0, 10);
}

/** Build revenue + payment-count series from validated managed payments. */
export function buildRevenueSeries(
  payments: PublicPayment[],
  range: ChartRangeKey,
  now = new Date(),
): RevenueSeriesPoint {
  const validated = payments.filter(isValidated);

  if (range === '1m') {
    const buckets: { start: Date; label: string }[] = [];
    for (let i = 3; i >= 0; i -= 1) {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - i * 7);
      const dayNum = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - dayNum);
      buckets.push({ start, label: `S${4 - i}` });
    }
    const map = new Map(
      buckets.map((b) => [weekKey(b.start), { revenue: 0, count: 0 }]),
    );
    for (const p of validated) {
      const d = new Date(p.createdAt);
      const key = weekKey(d);
      const bucket = map.get(key);
      if (!bucket) continue;
      bucket.revenue += amountOf(p);
      bucket.count += 1;
    }
    return {
      categories: buckets.map((b) => b.label),
      revenue: buckets.map((b) =>
        Math.round(map.get(weekKey(b.start))?.revenue ?? 0),
      ),
      paymentCounts: buckets.map(
        (b) => map.get(weekKey(b.start))?.count ?? 0,
      ),
    };
  }

  const months = range === '6m' ? 6 : 12;
  const buckets: { key: string; label: string }[] = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: monthKey(d),
      label: MONTH_SHORT[d.getMonth()] ?? '',
    });
  }
  const map = new Map(buckets.map((b) => [b.key, { revenue: 0, count: 0 }]));
  for (const p of validated) {
    const d = new Date(p.createdAt);
    const key = monthKey(d);
    const bucket = map.get(key);
    if (!bucket) continue;
    bucket.revenue += amountOf(p);
    bucket.count += 1;
  }
  return {
    categories: buckets.map((b) => b.label),
    revenue: buckets.map((b) => Math.round(map.get(b.key)?.revenue ?? 0)),
    paymentCounts: buckets.map((b) => map.get(b.key)?.count ?? 0),
  };
}

/** Donut + table rows from managed property modes. */
export function buildPropertyModeSeries(
  properties: Array<Pick<PublicProperty, 'mode'>>,
): PropertyModeSeries {
  const counts: Record<PropertyMode, number> = {
    RENT_SHORT: 0,
    RENT_LONG: 0,
    SALE: 0,
  };
  for (const p of properties) {
    if (p.mode in counts) counts[p.mode as PropertyMode] += 1;
  }
  const total = MODE_ORDER.reduce((sum, m) => sum + counts[m], 0);
  const series: [number, number, number] = [
    counts.RENT_SHORT,
    counts.RENT_LONG,
    counts.SALE,
  ];
  return {
    series,
    rows: MODE_ORDER.map((mode) => {
      const count = counts[mode];
      const percent =
        total === 0 ? '0%' : `${Math.round((count / total) * 100)}%`;
      return { name: MODE_LABELS[mode], count, percent };
    }),
  };
}

export function buildDailySparkline(
  valueOf: (isoDay: string) => number,
  now = new Date(),
): number[] {
  const out: number[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push(valueOf(key));
  }
  return out;
}

export function countByCreatedDay(
  items: Array<{ createdAt: string }>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item.createdAt.slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}
