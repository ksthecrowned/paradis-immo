import {
  buildProspectPipeline,
  mapBookingToActivityItem,
  mapPaymentToActivityItem,
  mapRentLineToActivityItem,
  mapSaleInquiryToActivityItem,
  mapVisitToActivityItem,
  type ActivityItem,
  type ActivitySegment,
  type ProspectSection,
} from '@/lib/activity-build';
import { listMyBookings } from '@/lib/bookings';
import { fetchCatalogProperty } from '@/lib/catalog';
import {
  getLeaseSchedule,
  listMyLeases,
  mapScheduleEntry,
  nextPendingDue,
  type PublicLease,
} from '@/lib/leases';
import { listMyPayments } from '@/lib/payments';
import { listMySaleInquiries } from '@/lib/sales';
import { listMyVisits } from '@/lib/visits';

export type {
  ActivityItem,
  ActivitySegment,
  ActivityTone,
  ProspectSection,
} from '@/lib/activity-build';
export {
  ACTIVITY_TABS,
  buildProspectPipeline,
  mapBookingToActivityItem,
  mapPaymentToActivityItem,
  mapRentLineToActivityItem,
  mapSaleInquiryToActivityItem,
  mapVisitToActivityItem,
} from '@/lib/activity-build';

type PropertyGlance = { title: string; location: string };

async function resolvePropertyGlances(
  propertyIds: string[],
): Promise<Map<string, PropertyGlance>> {
  const unique = [...new Set(propertyIds.filter(Boolean))];
  const map = new Map<string, PropertyGlance>();
  await Promise.all(
    unique.map(async (id) => {
      try {
        const property = await fetchCatalogProperty(id);
        map.set(id, {
          title: property.title || 'Bien',
          location: property.location || property.cityName || 'Pointe-Noire',
        });
      } catch {
        map.set(id, { title: 'Bien', location: 'Pointe-Noire' });
      }
    }),
  );
  return map;
}

function glanceOf(
  map: Map<string, PropertyGlance>,
  propertyId: string,
): PropertyGlance {
  return map.get(propertyId) ?? { title: 'Bien', location: 'Pointe-Noire' };
}

async function loadRentActivityItems(): Promise<ActivityItem[]> {
  const leases = await listMyLeases();
  const active = leases.filter((l) => l.status === 'ACTIVE');
  const rows: Array<{
    lease: PublicLease;
    line: ReturnType<typeof mapScheduleEntry>;
  }> = [];
  await Promise.all(
    active.map(async (lease) => {
      try {
        const schedule = await getLeaseSchedule(lease.id);
        const next = nextPendingDue(schedule.map(mapScheduleEntry));
        if (next) rows.push({ lease, line: next });
      } catch {
        // Schedule optional
      }
    }),
  );
  const glances = await resolvePropertyGlances(
    rows.map((r) => r.lease.propertyId),
  );
  return rows.map(({ lease, line }) =>
    mapRentLineToActivityItem(lease, line, glanceOf(glances, lease.propertyId)),
  );
}

export async function fetchActivity(
  segment: ActivitySegment,
): Promise<ActivityItem[]> {
  if (segment === 'visits') {
    const visits = await listMyVisits();
    const glances = await resolvePropertyGlances(
      visits.map((v) => v.propertyId),
    );
    return visits.map((v) =>
      mapVisitToActivityItem(v, glanceOf(glances, v.propertyId)),
    );
  }
  if (segment === 'bookings') {
    const bookings = await listMyBookings();
    const glances = await resolvePropertyGlances(
      bookings.map((b) => b.propertyId),
    );
    return bookings.map((b) =>
      mapBookingToActivityItem(b, glanceOf(glances, b.propertyId)),
    );
  }
  if (segment === 'sales') {
    const inquiries = await listMySaleInquiries();
    const glances = await resolvePropertyGlances(
      inquiries.map((i) => i.propertyId),
    );
    return inquiries.map((i) =>
      mapSaleInquiryToActivityItem(i, glanceOf(glances, i.propertyId)),
    );
  }
  if (segment === 'payments') {
    const payments = await listMyPayments();
    return payments.map((p) => mapPaymentToActivityItem(p));
  }
  return loadRentActivityItems();
}

export async function fetchProspectPipeline(): Promise<ProspectSection[]> {
  const [visits, bookings, sales, payments] = await Promise.all([
    fetchActivity('visits'),
    fetchActivity('bookings'),
    fetchActivity('sales'),
    fetchActivity('payments'),
  ]);
  return buildProspectPipeline({ visits, bookings, sales, payments });
}
