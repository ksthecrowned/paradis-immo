import { listMyBookings } from '@/lib/bookings';
import {
  getLeaseSchedule,
  listMyLeases,
  mapScheduleEntry,
  nextPendingDue,
} from '@/lib/leases';
import {
  buildPortfolioProperties,
  buildPropertyTimeline,
  getActiveLeaseFromList,
} from '@/lib/portfolio-build';
import { listMySaleInquiries } from '@/lib/sales';
import { listMyVisits } from '@/lib/visits';

export type {
  PortfolioItem,
  PortfolioRelation,
  PortfolioSources,
  TimelineEvent,
  TimelineEventKind,
} from '@/lib/portfolio-build';
export {
  buildPortfolioProperties,
  buildPropertyTimeline,
  getActiveLeaseFromList,
  portfolioRelationLabel,
} from '@/lib/portfolio-build';

export async function fetchPortfolioProperties() {
  const [leases, bookings, visits, inquiries] = await Promise.all([
    listMyLeases(),
    listMyBookings(),
    listMyVisits(),
    listMySaleInquiries(),
  ]);

  const active = leases.filter((l) => l.status === 'ACTIVE');
  const nextDueByLeaseId: Record<
    string,
    ReturnType<typeof mapScheduleEntry>
  > = {};
  await Promise.all(
    active.map(async (lease) => {
      try {
        const schedule = await getLeaseSchedule(lease.id);
        const next = nextPendingDue(schedule.map(mapScheduleEntry));
        if (next) nextDueByLeaseId[lease.id] = next;
      } catch {
        // Schedule optional for list cards
      }
    }),
  );

  return buildPortfolioProperties({
    leases,
    bookings,
    visits,
    inquiries,
    nextDueByLeaseId,
  });
}

export async function fetchActiveLeaseForProperty(propertyId: string) {
  const leases = await listMyLeases();
  return getActiveLeaseFromList(leases, propertyId);
}

export async function fetchPropertyTimeline(propertyId: string) {
  const [leases, bookings, visits, inquiries] = await Promise.all([
    listMyLeases(),
    listMyBookings(),
    listMyVisits(),
    listMySaleInquiries(),
  ]);
  return buildPropertyTimeline(propertyId, {
    leases,
    bookings,
    visits,
    inquiries,
  });
}
