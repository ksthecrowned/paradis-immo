import { describe, expect, test } from 'bun:test';
import {
  buildProspectPipeline,
  mapBookingToActivityItem,
  mapPaymentToActivityItem,
  mapRentLineToActivityItem,
  mapSaleInquiryToActivityItem,
  mapVisitToActivityItem,
} from './activity-build';
import type { PublicBooking } from './bookings';
import type { PublicLease, RentLineView } from './leases';
import type { PublicPayment } from './payments';
import type { PublicSaleInquiry } from './sales';
import type { PublicVisitBooking } from './visits';

const glance = { title: 'Villa Test', location: 'Centre-ville' };

describe('activity mappers', () => {
  test('maps visit with slot times', () => {
    const visit: PublicVisitBooking = {
      id: 'v1',
      slotId: 's1',
      propertyId: 'p1',
      userId: 'u1',
      status: 'CONFIRMED',
      paymentId: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      slotStartAt: '2026-09-10T09:00:00.000Z',
      slotEndAt: '2026-09-10T09:30:00.000Z',
    };
    const item = mapVisitToActivityItem(visit, glance);
    expect(item.segment).toBe('visits');
    expect(item.statusLabel).toBe('Confirmée');
    expect(item.tone).toBe('success');
    expect(item.title).toBe('Villa Test');
    expect(item.meta).toContain('09:00');
  });

  test('maps booking with stayId for navigation', () => {
    const booking: PublicBooking = {
      id: 'b1',
      propertyId: 'p1',
      userId: 'u1',
      startDate: '2026-09-12T00:00:00.000Z',
      endDate: '2026-09-14T00:00:00.000Z',
      totalPrice: '90000',
      currency: 'XAF',
      status: 'PENDING',
      createdAt: '2026-09-01T10:00:00.000Z',
    };
    const item = mapBookingToActivityItem(booking, glance);
    expect(item.stayId).toBe('b1');
    expect(item.statusLabel).toBe('En attente');
    expect(item.meta).toContain('90 000 FCFA');
  });

  test('maps sale inquiry and payment', () => {
    const inquiry: PublicSaleInquiry = {
      id: 'i1',
      propertyId: 'p1',
      userId: 'u1',
      message: null,
      status: 'NEW',
      createdAt: '2026-09-01T10:00:00.000Z',
    };
    const payment: PublicPayment = {
      id: 'pay1',
      userId: 'u1',
      amount: '5000',
      currency: 'XAF',
      method: 'CASH',
      provider: null,
      status: 'PENDING_VALIDATION',
      reference: 'ref',
      idempotencyKey: 'key',
      validatedBy: null,
      validatedAt: null,
      allocations: [
        {
          id: 'a1',
          type: 'VISIT',
          refId: 'p1',
          amount: '5000',
          rentScheduleId: null,
        },
      ],
      createdAt: '2026-09-01T10:00:00.000Z',
    };
    expect(mapSaleInquiryToActivityItem(inquiry, glance).purchaseId).toBe('i1');
    expect(mapPaymentToActivityItem(payment).title).toBe('Paiement');
    expect(mapPaymentToActivityItem(payment).meta).toContain('Espèces');
  });

  test('maps rent line and builds prospect sections', () => {
    const lease: PublicLease = {
      id: 'lease-1',
      propertyId: 'p1',
      tenantId: 'u1',
      startDate: '2026-01-01',
      endDate: '2027-01-01',
      monthlyRent: '150000',
      deposit: '150000',
      currency: 'XAF',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const line: RentLineView = {
      id: 'rs1',
      leaseId: 'lease-1',
      label: 'Septembre 2026',
      dueDate: '2026-09-05',
      amount: 150000,
      status: 'PENDING',
      currency: 'XAF',
    };
    const rent = mapRentLineToActivityItem(lease, line, glance);
    expect(rent.leaseId).toBe('lease-1');
    expect(rent.segment).toBe('rents');

    const sections = buildProspectPipeline({
      visits: [
        {
          id: 'v1',
          segment: 'visits',
          propertyId: 'p1',
          title: 'A',
          location: 'B',
          statusLabel: 'Confirmée',
          tone: 'success',
          meta: 'x',
        },
      ],
      bookings: [
        {
          id: 'b1',
          segment: 'bookings',
          propertyId: 'p1',
          title: 'A',
          location: 'B',
          statusLabel: 'Confirmée',
          tone: 'success',
          meta: 'x',
        },
      ],
      sales: [],
      payments: [
        {
          id: 'pay',
          segment: 'payments',
          propertyId: 'p1',
          title: 'A',
          location: 'B',
          statusLabel: 'Échoué',
          tone: 'danger',
          meta: 'x',
        },
      ],
    });
    expect(sections.map((s) => s.key)).toEqual(['upcoming', 'in_progress']);
    expect(sections[0]!.items).toHaveLength(1);
    expect(sections[1]!.items).toHaveLength(1);
    expect(sections[1]!.items[0]!.segment).toBe('bookings');
  });
});
