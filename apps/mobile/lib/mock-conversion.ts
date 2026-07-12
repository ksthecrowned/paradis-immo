export type MockVisitSlot = {
  id: string;
  dayKey: string;
  dayLabel: string;
  startLabel: string;
  endLabel: string;
  paid: boolean;
  priceLabel?: string;
};

export type MockPaymentSession = {
  id: string;
  kind: 'visit' | 'stay' | 'rent';
  propertyId: string;
  amountLabel: string;
  title: string;
};

const paymentSessions = new Map<string, MockPaymentSession>();

paymentSessions.set('pay-rent-jul', {
  id: 'pay-rent-jul',
  kind: 'rent',
  propertyId: '2',
  amountLabel: '100 000 FCFA',
  title: 'Loyer · Juillet 2026',
});

paymentSessions.set('pay-rent-may', {
  id: 'pay-rent-may',
  kind: 'rent',
  propertyId: '2',
  amountLabel: '100 000 FCFA',
  title: 'Loyer · Mai 2026',
});

const VISIT_DAYS = [
  { key: '2026-07-12', label: 'Sam. 12' },
  { key: '2026-07-13', label: 'Dim. 13' },
  { key: '2026-07-14', label: 'Lun. 14' },
];

const SLOTS: MockVisitSlot[] = [
  {
    id: 'slot-1a',
    dayKey: '2026-07-12',
    dayLabel: 'Sam. 12',
    startLabel: '10:00',
    endLabel: '10:30',
    paid: false,
  },
  {
    id: 'slot-1b',
    dayKey: '2026-07-12',
    dayLabel: 'Sam. 12',
    startLabel: '15:00',
    endLabel: '15:30',
    paid: true,
    priceLabel: '5 000 FCFA',
  },
  {
    id: 'slot-2a',
    dayKey: '2026-07-13',
    dayLabel: 'Dim. 13',
    startLabel: '09:30',
    endLabel: '10:00',
    paid: false,
  },
  {
    id: 'slot-3a',
    dayKey: '2026-07-14',
    dayLabel: 'Lun. 14',
    startLabel: '11:00',
    endLabel: '11:30',
    paid: true,
    priceLabel: '5 000 FCFA',
  },
];

/** Nightly rate used for short-stay mock quotes (property 3 style). */
const NIGHTLY_BY_PROPERTY: Record<string, number> = {
  '3': 45_000,
  '1': 80_000,
  '2': 35_000,
};

export function nightsBetween(startIso: string, endIso: string): number {
  const start = Date.parse(`${startIso}T00:00:00`);
  const end = Date.parse(`${endIso}T00:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

export function quoteShortStay(
  propertyId: string,
  startIso: string,
  endIso: string,
): { nights: number; totalAmount: number; totalLabel: string } {
  const nights = nightsBetween(startIso, endIso);
  const nightly = NIGHTLY_BY_PROPERTY[propertyId] ?? 40_000;
  const totalAmount = nights * nightly;
  return {
    nights,
    totalAmount,
    totalLabel: formatFcfa(totalAmount),
  };
}

export function getMockVisitDays(
  _propertyId: string,
): Array<{ key: string; label: string }> {
  return VISIT_DAYS;
}

export function getMockVisitSlots(
  _propertyId: string,
  dayKey: string,
): MockVisitSlot[] {
  return SLOTS.filter((slot) => slot.dayKey === dayKey);
}

export function createMockPaymentSession(input: {
  kind: 'visit' | 'stay' | 'rent';
  propertyId: string;
  amountLabel: string;
  title: string;
}): { id: string } {
  const id = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  paymentSessions.set(id, { id, ...input });
  return { id };
}

export function getMockPaymentSession(
  id: string,
): MockPaymentSession | undefined {
  return paymentSessions.get(id);
}
