import type { PublicVisitSlot } from '@/lib/visits';
import type { Property } from '@/types/property';

export type VisitDay = { key: string; label: string };

export type VisitSlotRow = {
  id: string;
  dayKey: string;
  startLabel: string;
  endLabel: string;
  paid: boolean;
  priceLabel?: string;
};

function formatDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDayLabel(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTimeLabel(d: Date): string {
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function priceLabel(amount: number | null | undefined): string | undefined {
  if (amount == null || Number.isNaN(amount)) return undefined;
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

export function groupVisitSlotsByDay(
  slots: PublicVisitSlot[],
  property: Pick<Property, 'visitType' | 'visitPrice'>,
): {
  days: VisitDay[];
  slotsForDay: (dayKey: string) => VisitSlotRow[];
} {
  const paid = property.visitType === 'PAID';
  const label = priceLabel(property.visitPrice);
  const available = slots.filter((s) => s.status === 'AVAILABLE');

  const byDay = new Map<string, VisitSlotRow[]>();
  for (const slot of available) {
    const start = new Date(slot.startAt);
    const end = new Date(slot.endAt);
    const dayKey = formatDayKey(start);
    const row: VisitSlotRow = {
      id: slot.id,
      dayKey,
      startLabel: formatTimeLabel(start),
      endLabel: formatTimeLabel(end),
      paid,
      priceLabel: paid ? label : undefined,
    };
    const list = byDay.get(dayKey) ?? [];
    list.push(row);
    byDay.set(dayKey, list);
  }

  const days: VisitDay[] = [...byDay.keys()]
    .sort()
    .map((key) => {
      const [y, m, d] = key.split('-').map(Number);
      const date = new Date(y!, m! - 1, d!);
      return { key, label: formatDayLabel(date) };
    });

  for (const list of byDay.values()) {
    list.sort((a, b) => a.startLabel.localeCompare(b.startLabel));
  }

  return {
    days,
    slotsForDay: (dayKey: string) => byDay.get(dayKey) ?? [],
  };
}
