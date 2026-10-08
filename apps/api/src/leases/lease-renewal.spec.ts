import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LeasesModule } from './leases.module';
import { LeaseRenewalProcessor } from './lease-renewal.processor';
import { LeasesService } from './leases.service';
import { RentScheduleGenerator } from './rent-schedule.generator.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import { R2Service } from '../media/r2.service';

/**
 * Spec 04 US 11 — renouvellement du bail :
 * - `POST /leases/:id/renew` prolonge le terme (et le loyer) ; sous mandat
 *   vivant, un changement de loyer crée une approbation RENT_INCREASE /
 *   RENT_REDUCTION qui, une fois approuvée, prolonge le bail et génère
 *   l'échéancier du nouveau terme ;
 * - le cron signale l'échéance à J-90 et J-30 (dé-doublonné) et renouvelle
 *   tacitement un bail `autoRenew` arrivé à terme (+1 an).
 */
describe('LeaseRenewalProcessor + renewLease — renouvellement (spec 04 US 11)', () => {
  let leases: LeasesService;
  let approvals: MandateApprovalService;
  let processor: LeaseRenewalProcessor;
  let scheduleGen: RentScheduleGenerator;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let agencyUserId: string;
  let tenantUserId: string;
  let ownerPropId: string;
  let agencyPropId: string;
  let agencyOrgId: string;
  const DAY = 86_400_000;
  const createdLeaseIds: string[] = [];
  const phones = {
    owner: '+242070000141',
    agency: '+242070000142',
    tenant: '+242070000143',
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, LeasesModule],
    })
      .overrideProvider(R2Service)
      .useValue({
        uploadPrivateFile: jest.fn(async () => ({ url: 'https://x/y', key: 'y' })),
        uploadLeaseFile: jest.fn(async () => ({ url: 'https://x/y', key: 'y' })),
        keyFromPublicUrl: jest.fn(() => 'y'),
      })
      .compile();

    leases = moduleRef.get(LeasesService);
    approvals = moduleRef.get(MandateApprovalService);
    processor = moduleRef.get(LeaseRenewalProcessor);
    scheduleGen = moduleRef.get(RentScheduleGenerator);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    const stale = await prisma.user.findMany({
      where: { phone: { in: Object.values(phones) } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const mk = async (phone: string, name: string) =>
      prisma.user.create({
        data: { phone, countryId, name, roles: { create: { role: 'TENANT' } } },
      });
    ownerUserId = (await mk(phones.owner, 'Spec04 Renew Owner')).id;
    agencyUserId = (await mk(phones.agency, 'Spec04 Renew Agency')).id;
    tenantUserId = (await mk(phones.tenant, 'Spec04 Renew Tenant')).id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Spec04 Renew Owner Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const agencyOrg = await prisma.organization.create({
      data: {
        name: `Spec04 Renew Agency Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: agencyUserId, role: 'ADMIN' } },
      },
    });
    agencyOrgId = agencyOrg.id;

    const base = {
      description: 'Renouvellement',
      type: 'APARTMENT',
      mode: 'RENT_LONG',
      currency: 'XAF',
      priceUnit: 'MONTH',
      quartierId: bzvQuartierId,
      countryId,
      status: 'ACTIVE',
    } as const;
    ownerPropId = (
      await prisma.property.create({
        data: {
          ...base,
          title: 'Spec04 Renew Property',
          price: 100000,
          address: 'Spec04 Renew',
          ownerId: ownerUserId,
          organizationId: ownerOrg.id,
        },
      })
    ).id;
    agencyPropId = (
      await prisma.property.create({
        data: {
          ...base,
          title: 'Spec04 Renew Mandated',
          price: 100000,
          address: 'Spec04 Renew mandat',
          ownerId: ownerUserId,
          organizationId: agencyOrg.id,
        },
      })
    ).id;
    await prisma.mandate.create({
      data: {
        propertyId: agencyPropId,
        organizationId: agencyOrgId,
        status: 'ACTIVE',
        proposedById: ownerUserId,
      },
    });
  });

  afterAll(async () => {
    await prisma.mandateApproval
      .deleteMany({ where: { sourceId: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.mandate.deleteMany({
      where: { propertyId: { in: [ownerPropId, agencyPropId] } },
    });
    await prisma.rentSchedule
      .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.lease
      .deleteMany({ where: { id: { in: createdLeaseIds } } })
      .catch(() => undefined);
    const ids = [ownerUserId, agencyUserId, tenantUserId];
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.property
      .deleteMany({ where: { id: { in: [ownerPropId, agencyPropId] } } })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { userId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: agencyOrgId } }).catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { members: { some: { userId: ownerUserId } } } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  /** ACTIVE lease with the current term's schedule already generated. */
  async function activeLease(
    propertyId: string,
    endDaysAhead: number,
    options: { autoRenew?: boolean } = {},
  ): Promise<{ id: string; startDate: Date; endDate: Date }> {
    const startDate = new Date(Date.now() - 60 * DAY);
    const endDate = new Date(Date.now() + endDaysAhead * DAY);
    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate,
        endDate,
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
        status: 'ACTIVE',
        dueDay: 5,
        autoRenew: options.autoRenew ?? true,
      },
    });
    createdLeaseIds.push(lease.id);
    await scheduleGen.generateForLease(lease.id, {
      startDate: lease.startDate,
      endDate: lease.endDate,
      monthlyRent: lease.monthlyRent.toString(),
      chargesAmount: lease.chargesAmount.toString(),
      dueDay: lease.dueDay,
      currency: lease.currency,
      deposit: lease.deposit.toString(),
    });
    return { id: lease.id, startDate: lease.startDate, endDate: lease.endDate };
  }

  it('extends the term and the rent immediately (no mandate)', async () => {
    const lease = await activeLease(ownerPropId, 30);
    const newEndDate = new Date(lease.endDate.getTime() + 365 * DAY);

    const result = await leases.renewLease(ownerUserId, lease.id, {
      newEndDate,
      newMonthlyRent: 110000,
    });
    expect(result.applied).toBe(true);
    expect(result.approvalId).toBeNull();

    const updated = await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } });
    expect(updated.endDate.getTime()).toBe(newEndDate.getTime());
    expect(updated.monthlyRent.toString()).toBe('110000');

    const lines = await prisma.rentSchedule.findMany({
      where: { leaseId: lease.id, kind: 'RENT' },
      orderBy: { dueDate: 'asc' },
    });
    const past = lines.filter((l) => l.dueDate <= lease.endDate);
    const future = lines.filter((l) => l.dueDate > lease.endDate);
    expect(past.length).toBeGreaterThan(0);
    expect(past.every((l) => l.rentPart.toString() === '100000')).toBe(true);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((l) => l.rentPart.toString() === '110000')).toBe(true);
    // No duplicated (leaseId, dueDate, kind) line after the regeneration.
    const keys = lines.map((l) => `${l.dueDate.toISOString()}|${l.kind}`);
    expect(new Set(keys).size).toBe(keys.length);

    const notified = await prisma.notification.findFirst({
      where: {
        userId: tenantUserId,
        type: 'LEASE_RENEWED',
        payload: { path: ['leaseId'], equals: lease.id },
      },
    });
    expect(notified).not.toBeNull();
    expect(notified?.payload).toMatchObject({ leaseId: lease.id });
  });

  it('validates the actor, the status and the dates', async () => {
    const lease = await activeLease(ownerPropId, 30);

    await expect(
      leases.renewLease(agencyUserId, lease.id, {
        newEndDate: new Date(lease.endDate.getTime() + 365 * DAY),
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(
      leases.renewLease(ownerUserId, lease.id, { newEndDate: lease.endDate }),
    ).rejects.toMatchObject({ response: { code: 'INVALID_RENEWAL_END_DATE' } });

    const draft = await prisma.lease.create({
      data: {
        propertyId: ownerPropId,
        tenantId: tenantUserId,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * DAY),
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
        status: 'DRAFT',
        dueDay: 5,
      },
    });
    createdLeaseIds.push(draft.id);
    await expect(
      leases.renewLease(ownerUserId, draft.id, {
        newEndDate: new Date(Date.now() + 730 * DAY),
      }),
    ).rejects.toMatchObject({ response: { code: 'LEASE_NOT_ACTIVE' } });
  });

  it('under a live mandate a rent change waits for the owner approval', async () => {
    const lease = await activeLease(agencyPropId, 30);
    const newEndDate = new Date(lease.endDate.getTime() + 365 * DAY);

    const result = await leases.renewLease(agencyUserId, lease.id, {
      newEndDate,
      newMonthlyRent: 110000,
    });
    expect(result.applied).toBe(false);
    expect(result.approvalId).toBeTruthy();

    // Nothing applied before the owner decides.
    const pending = await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } });
    expect(pending.endDate.getTime()).toBe(lease.endDate.getTime());
    expect(pending.monthlyRent.toString()).toBe('100000');

    const proposed = await prisma.notification.findFirst({
      where: {
        userId: tenantUserId,
        type: 'LEASE_RENEWAL_PROPOSED',
        payload: { path: ['leaseId'], equals: lease.id },
      },
    });
    expect(proposed).not.toBeNull();

    const decided = await approvals.decideApproval(ownerUserId, result.approvalId!, {
      approve: true,
    });
    expect(decided.status).toBe('APPROVED');

    const approved = await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } });
    expect(approved.endDate.getTime()).toBe(newEndDate.getTime());
    expect(approved.monthlyRent.toString()).toBe('110000');

    const lines = await prisma.rentSchedule.findMany({
      where: { leaseId: lease.id, kind: 'RENT' },
      orderBy: { dueDate: 'asc' },
    });
    const past = lines.filter((l) => l.dueDate <= lease.endDate);
    const future = lines.filter((l) => l.dueDate > lease.endDate);
    expect(past.length).toBeGreaterThan(0);
    expect(past.every((l) => l.rentPart.toString() === '100000')).toBe(true);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((l) => l.rentPart.toString() === '110000')).toBe(true);
  });

  it('a term extension without rent change applies at once, even under mandate', async () => {
    const lease = await activeLease(agencyPropId, 30);
    const newEndDate = new Date(lease.endDate.getTime() + 365 * DAY);

    const result = await leases.renewLease(agencyUserId, lease.id, { newEndDate });
    expect(result.applied).toBe(true);
    expect(result.approvalId).toBeNull();

    const updated = await prisma.lease.findUniqueOrThrow({ where: { id: lease.id } });
    expect(updated.endDate.getTime()).toBe(newEndDate.getTime());
    expect(updated.monthlyRent.toString()).toBe('100000');
  });

  it('alerts at J-90 and J-30, deduplicated per recipient', async () => {
    const j90 = await activeLease(ownerPropId, 90);
    const j30 = await activeLease(ownerPropId, 30);

    const first = await processor.runDaily(new Date(), {
      leaseIds: [j90.id, j30.id],
    });
    // tenant + owner for each lease.
    expect(first.alerts).toBe(4);

    const alertsFor = (leaseId: string) =>
      prisma.notification.count({
        where: {
          type: 'LEASE_RENEWAL',
          payload: { path: ['leaseId'], equals: leaseId },
        },
      });
    expect(await alertsFor(j90.id)).toBe(2);
    expect(await alertsFor(j30.id)).toBe(2);

    const sample = await prisma.notification.findFirst({
      where: {
        userId: tenantUserId,
        type: 'LEASE_RENEWAL',
        payload: { path: ['leaseId'], equals: j90.id },
      },
    });
    expect(sample?.payload).toMatchObject({ daysLeft: 90, autoRenew: true });

    const second = await processor.runDaily(new Date(), {
      leaseIds: [j90.id, j30.id],
    });
    expect(second.alerts).toBe(0);
    expect(await alertsFor(j90.id)).toBe(2);
  });

  it('tacitly renews a lease past its end date and leaves the others alone', async () => {
    const due = await activeLease(ownerPropId, -1, { autoRenew: true });
    const fixedTerm = await activeLease(ownerPropId, -1, { autoRenew: false });

    const result = await processor.runDaily(new Date(), {
      leaseIds: [due.id, fixedTerm.id],
    });
    expect(result.renewed).toBe(1);

    const renewed = await prisma.lease.findUniqueOrThrow({ where: { id: due.id } });
    expect(renewed.endDate.getFullYear()).toBe(due.endDate.getFullYear() + 1);
    expect(renewed.endDate.getMonth()).toBe(due.endDate.getMonth());
    expect(renewed.endDate.getDate()).toBe(due.endDate.getDate());

    const lines = await prisma.rentSchedule.findMany({
      where: { leaseId: due.id, kind: 'RENT' },
    });
    const future = lines.filter((l) => l.dueDate > due.endDate);
    expect(future.length).toBeGreaterThan(0);
    expect(future.every((l) => l.amount.toString() === '100000')).toBe(true);

    const notified = await prisma.notification.findFirst({
      where: {
        userId: tenantUserId,
        type: 'LEASE_RENEWED',
        payload: { path: ['leaseId'], equals: due.id },
      },
    });
    expect(notified).not.toBeNull();
    expect(notified?.payload).toMatchObject({ tacit: true });

    const untouched = await prisma.lease.findUniqueOrThrow({ where: { id: fixedTerm.id } });
    expect(untouched.endDate.getTime()).toBe(fixedTerm.endDate.getTime());

    // A second run is a no-op: the renewed lease is no longer due.
    const again = await processor.runDaily(new Date(), {
      leaseIds: [due.id, fixedTerm.id],
    });
    expect(again.renewed).toBe(0);
  });
});
