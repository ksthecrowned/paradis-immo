import { describe, expect, test } from 'bun:test';
import {
  addMaintenanceTicket,
  canCreateMaintenance,
  canPayRentLine,
  getMockLease,
  leaseStatusLabel,
  listMockLeases,
  listRentActivityItems,
  listScheduleForLease,
  listTicketsForLease,
  nextDueForLease,
} from './mock-leases';

describe('mock leases', () => {
  test('lists active and terminated', () => {
    const leases = listMockLeases();
    expect(leases.length).toBeGreaterThanOrEqual(2);
    expect(leases.some((l) => l.status === 'ACTIVE')).toBe(true);
    expect(leases.some((l) => l.status === 'TERMINATED')).toBe(true);
  });

  test('active lease has payable line', () => {
    const lease = getMockLease('lease-1')!;
    const next = nextDueForLease('lease-1');
    expect(next?.status === 'PENDING' || next?.status === 'OVERDUE').toBe(true);
    expect(canPayRentLine(lease, next!)).toBe(true);
  });

  test('terminated cannot pay or create ticket', () => {
    const lease = getMockLease('lease-2')!;
    expect(canCreateMaintenance(lease)).toBe(false);
    const lines = listScheduleForLease('lease-2');
    for (const line of lines) {
      expect(canPayRentLine(lease, line)).toBe(false);
    }
  });

  test('addMaintenanceTicket prepends OPEN', () => {
    const before = listTicketsForLease('lease-1').length;
    const t = addMaintenanceTicket({
      leaseId: 'lease-1',
      title: 'Fuite',
      description: 'Cuisine',
      urgency: 'HIGH',
    });
    expect(t.status).toBe('OPEN');
    expect(listTicketsForLease('lease-1').length).toBe(before + 1);
    expect(listTicketsForLease('lease-1')[0]?.id).toBe(t.id);
  });

  test('rent activity projects schedule', () => {
    const items = listRentActivityItems();
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((i) => i.leaseId && i.propertyId)).toBe(true);
  });

  test('labels FR', () => {
    expect(leaseStatusLabel('ACTIVE')).toBe('Actif');
  });
});
