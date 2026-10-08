import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { LeaseStatus, ListingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { LeasesService } from './leases.service';
import { RentScheduleGenerator } from './rent-schedule.generator.service';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InfobipService } from '../notifications/infobip.service';
import { OtpStore } from '../auth/otp.store';
import { InfobipOtpService } from '../auth/infobip-otp.service';
import { PropertiesService } from '../properties/properties.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { FcmService } from '../notifications/fcm.service';

/**
 * Spec 04 P0 — activation guards (overlap, listing status), tenant invitation
 * instead of silent User creation, notice / withdrawal / closure, pagination.
 *
 * Fixtures are dedicated to this suite (own owner, tenant, property and an
 * unknown invitee phone) so it never collides with `leases.spec.ts`.
 */
describe('LeasesService — lifecycle (spec 04 P0)', () => {
  let leases: LeasesService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let propertyId: string;
  const createdLeaseIds: string[] = [];
  const whatsapp: Array<{ to: string; body: string }> = [];
  const emittedEvents: Array<{ name: string; payload: unknown }> = [];
  const notifications: Array<{ userId: string; type: string }> = [];

  beforeAll(async () => {
    const infobip: Pick<InfobipService, 'sendWhatsApp'> = {
      sendWhatsApp: jest.fn(
        async (to: string, body: string) => {
          whatsapp.push({ to, body });
          return { ok: true, providerMessageId: 'wa-1' };
        },
      ),
    };
    const fcm: Pick<FcmService, 'sendPush'> = {
      sendPush: jest.fn(async () => ({ ok: true })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        LeasesService,
        RentScheduleGenerator,
        PrismaService,
        UsersService,
        InfobipService,
        NotificationsService,
        OtpStore,
        InfobipOtpService,
        {
          provide: InfobipService,
          useValue: infobip,
        },
        { provide: FcmService, useValue: fcm },
        {
          provide: MandateApprovalService,
          useValue: { requireApproval: jest.fn() },
        },
        AgencyAccessService,
        {
          provide: EventPublisher,
          useValue: {
            emit: jest.fn(async (name, payload) => {
              emittedEvents.push({ name, payload });
              return { id: 'mock', name };
            }),
          },
        },
      ],
    }).compile();
    leases = moduleRef.get(LeasesService);
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

    const phones = ['+242070000011', '+242070000012'];
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });
    const owner = await prisma.user.create({
      data: {
        phone: phones[0],
        countryId,
        name: 'Spec04 Owner',
        notificationChannel: 'PUSH',
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const tenant = await prisma.user.create({
      data: {
        phone: phones[1],
        countryId,
        name: 'Spec04 Tenant',
        notificationChannel: 'PUSH',
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec04 Owner Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const prop = await prisma.property.create({
      data: {
        title: 'Spec04 Property',
        description: 'Bien pour les tests de cycle de bail',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'Spec04',
        countryId,
        ownerId: ownerUserId,
        organizationId: org.id,
      },
    });
    propertyId = prop.id;
  });

  afterAll(async () => {
    if (createdLeaseIds.length) {
      await prisma.rentSchedule
        .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
        .catch(() => undefined);
      await prisma.notification
        .deleteMany({ where: { userId: { in: [ownerUserId, tenantUserId] } } })
        .catch(() => undefined);
      await prisma.lease
        .deleteMany({ where: { id: { in: createdLeaseIds } } })
        .catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId] } },
    });
    await prisma.organization
      .deleteMany({
        where: { members: { some: { userId: { in: [ownerUserId, tenantUserId] } } } },
      })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, tenantUserId] } },
    });
    await prisma.onModuleDestroy();
  });

  beforeEach(() => {
    whatsapp.length = 0;
    emittedEvents.length = 0;
    notifications.length = 0;
  });

  async function resetPropertyStatus(): Promise<void> {
    await prisma.property.update({
      where: { id: propertyId },
      data: { listingStatus: ListingStatus.AVAILABLE },
    });
  }

  it('creating a lease for an unknown number inserts no User and invites over WhatsApp', async () => {
    const unknownPhone = '+242070009999';
    await prisma.user.deleteMany({ where: { phone: unknownPhone } });

    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      invitedPhone: unknownPhone,
      startDate: new Date('2029-01-01T00:00:00Z'),
      endDate: new Date('2029-12-31T00:00:00Z'),
      monthlyRent: '120000',
      currency: 'XAF',
      deposit: '240000',
    });
    createdLeaseIds.push(lease.id);

    expect(lease.tenantId).toBeNull();
    expect(lease.invitedPhone).toBe(unknownPhone);
    const users = await prisma.user.count({ where: { phone: unknownPhone } });
    expect(users).toBe(0);

    const invited = whatsapp.filter((m) => m.to === unknownPhone);
    expect(invited.length).toBeGreaterThanOrEqual(1);
    expect(invited[0].body).toContain('bail');
  });

  it('send-for-signature moves DRAFT to PENDING_SIGNATURE and re-invites the tenant', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      invitedPhone: '+242070009998',
      startDate: new Date('2029-02-01T00:00:00Z'),
      endDate: new Date('2029-06-30T00:00:00Z'),
      monthlyRent: '90000',
      currency: 'XAF',
      deposit: '180000',
    });
    createdLeaseIds.push(lease.id);

    const sent = await leases.sendForSignature(ownerUserId, lease.id);
    expect(sent.status).toBe(LeaseStatus.PENDING_SIGNATURE);
    expect(
      whatsapp.filter((m) => m.to === '+242070009998').length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('activation sets the property to OCCUPIED and drops it from the RENT_LONG marketplace', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2030-01-01T00:00:00Z'),
      endDate: new Date('2030-06-30T00:00:00Z'),
      monthlyRent: '150000',
      currency: 'XAF',
      deposit: '300000',
    });
    createdLeaseIds.push(lease.id);

    const activated = await leases.activateLease(ownerUserId, lease.id);
    expect(activated.status).toBe(LeaseStatus.ACTIVE);

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    expect(property?.listingStatus).toBe(ListingStatus.OCCUPIED);

    const propertyModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        PrismaService,
        { provide: OrganizationsService, useValue: {} },
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
        AgencyAccessService,
        UsersService,
      ],
    }).compile();
    const properties = propertyModule.get(PropertiesService);
    const listed = await properties.list({ mode: 'RENT_LONG' as never });
    expect(listed.data.some((p) => p.id === propertyId)).toBe(false);
    await propertyModule.close();
  });

  it('activating an overlapping lease returns 409 LEASE_OVERLAP', async () => {
    const existing = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2031-01-01T00:00:00Z'),
      endDate: new Date('2031-12-31T00:00:00Z'),
      monthlyRent: '100000',
      currency: 'XAF',
      deposit: '200000',
    });
    createdLeaseIds.push(existing.id);
    await leases.activateLease(ownerUserId, existing.id);

    const overlapping = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2031-06-01T00:00:00Z'),
      endDate: new Date('2032-05-31T00:00:00Z'),
      monthlyRent: '100000',
      currency: 'XAF',
      deposit: '200000',
    });
    createdLeaseIds.push(overlapping.id);

    await expect(
      leases.activateLease(ownerUserId, overlapping.id),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      leases.activateLease(ownerUserId, overlapping.id),
    ).rejects.toMatchObject({
      response: { code: 'LEASE_OVERLAP' },
    });

    const stillDraft = await prisma.lease.findUnique({
      where: { id: overlapping.id },
    });
    expect(stillDraft?.status).toBe(LeaseStatus.DRAFT);

    await prisma.lease.update({
      where: { id: existing.id },
      data: { status: LeaseStatus.TERMINATED },
    });
  });

  it('a confirmed booking overlapping the lease period also returns LEASE_OVERLAP', async () => {
    const bookingUser = await prisma.user.create({
      data: {
        phone: `+2420701${String(Date.now()).slice(-6)}`,
        countryId,
        name: 'Spec04 Booker',
      },
    });
    const booking = await prisma.booking.create({
      data: {
        propertyId,
        userId: bookingUser.id,
        startDate: new Date('2032-01-01T00:00:00Z'),
        endDate: new Date('2032-01-10T00:00:00Z'),
        totalPrice: 50000,
        currency: 'XAF',
        status: 'CONFIRMED',
      },
    });
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2032-01-05T00:00:00Z'),
      endDate: new Date('2032-12-31T00:00:00Z'),
      monthlyRent: '100000',
      currency: 'XAF',
      deposit: '200000',
    });
    createdLeaseIds.push(lease.id);

    await expect(
      leases.activateLease(ownerUserId, lease.id),
    ).rejects.toMatchObject({ response: { code: 'LEASE_OVERLAP' } });

    await prisma.booking.delete({ where: { id: booking.id } });
    await prisma.user.delete({ where: { id: bookingUser.id } });
  });

  it('a tenant notice is clamped to noticeAt + 3 months and cancels the later schedules', async () => {
    // Far-future term so the clamped effective date lands inside the schedule.
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2028-01-01T00:00:00Z'),
      endDate: new Date('2028-12-31T00:00:00Z'),
      monthlyRent: '80000',
      currency: 'XAF',
      deposit: '160000',
      noticeMonthsTenant: 3,
    });
    createdLeaseIds.push(lease.id);
    await leases.activateLease(ownerUserId, lease.id);

    // Requested date is way too early (notice starts today): it must be
    // clamped to noticeAt + 3 months (15/04 when notice is given on 15/01).
    const clamped = await leases.requestTermination(tenantUserId, lease.id, {
      initiator: 'TENANT',
      reason: 'Déménagement',
      requestedEndDate: new Date('2028-01-15T00:00:00Z'),
    });
    expect(clamped.status).toBe(LeaseStatus.TERMINATING);
    const noticeAt = new Date(clamped.terminationNoticeAt as string);
    const earliest = new Date(noticeAt);
    earliest.setUTCMonth(earliest.getUTCMonth() + 3);
    const effective = new Date(clamped.terminationEffectiveAt as string);
    // Effective date is exactly max(requestedEndDate, noticeAt + 3 months).
    expect(effective.getTime()).toBe(
      Math.max(
        new Date('2028-01-15T00:00:00Z').getTime(),
        earliest.getTime(),
      ),
    );

    const schedules = await prisma.rentSchedule.findMany({
      where: { leaseId: lease.id },
      orderBy: { dueDate: 'asc' },
    });
    const afterExit = schedules.filter(
      (s) => s.dueDate.getTime() > effective.getTime(),
    );
    expect(afterExit.length).toBeGreaterThan(0);
    expect(afterExit.every((s) => s.status === 'CANCELLED')).toBe(true);
    const beforeExit = schedules.filter(
      (s) => s.dueDate.getTime() <= effective.getTime(),
    );
    expect(beforeExit.length).toBeGreaterThan(0);
    expect(beforeExit.every((s) => s.status !== 'CANCELLED')).toBe(true);

    const withdrawn = await leases.withdrawTermination(tenantUserId, lease.id);
    expect(withdrawn.status).toBe(LeaseStatus.ACTIVE);
    expect(withdrawn.terminationEffectiveAt).toBeNull();
    const restored = await prisma.rentSchedule.count({
      where: { leaseId: lease.id, status: 'CANCELLED' },
    });
    expect(restored).toBe(0);
  });

  it('a notice whose requested date is later than the notice period is honoured', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2029-01-01T00:00:00Z'),
      endDate: new Date('2029-12-31T00:00:00Z'),
      monthlyRent: '80000',
      currency: 'XAF',
      deposit: '160000',
      noticeMonthsTenant: 3,
    });
    createdLeaseIds.push(lease.id);
    await leases.activateLease(ownerUserId, lease.id);

    const notice = await leases.requestTermination(tenantUserId, lease.id, {
      initiator: 'TENANT',
      requestedEndDate: new Date('2029-10-31T00:00:00Z'),
    });
    expect(notice.terminationEffectiveAt).toContain('2029-10-31');
    const schedules = await prisma.rentSchedule.findMany({
      where: { leaseId: lease.id },
      orderBy: { dueDate: 'asc' },
    });
    expect(
      schedules.filter(
        (s) => s.dueDate.getTime() > new Date('2029-10-31T00:00:00Z').getTime(),
      ),
    ).toHaveLength(2);
  });

  it('closing an elapsed lease sets TERMINATED and releases the property', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2019-01-01T00:00:00Z'),
      endDate: new Date('2019-12-31T00:00:00Z'),
      monthlyRent: '70000',
      currency: 'XAF',
      deposit: '140000',
      noticeMonthsTenant: 0,
    });
    createdLeaseIds.push(lease.id);
    await leases.activateLease(ownerUserId, lease.id);
    await prisma.property.update({
      where: { id: propertyId },
      data: { listingStatus: ListingStatus.OCCUPIED },
    });

    await leases.requestTermination(tenantUserId, lease.id, {
      initiator: 'TENANT',
      requestedEndDate: new Date('2019-06-30T00:00:00Z'),
    });

    const closed = await leases.closeLease(ownerUserId, lease.id);
    expect(closed.status).toBe(LeaseStatus.TERMINATED);
    expect(closed.terminatedAt).not.toBeNull();
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    expect(property?.listingStatus).toBe(ListingStatus.AVAILABLE);
    const remaining = await prisma.rentSchedule.count({
      where: {
        leaseId: lease.id,
        status: { in: ['PENDING', 'OVERDUE', 'PARTIAL'] },
      },
    });
    expect(remaining).toBe(0);
  });

  it('cancelling an ACTIVE lease is rejected', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2033-01-01T00:00:00Z'),
      endDate: new Date('2033-12-31T00:00:00Z'),
      monthlyRent: '60000',
      currency: 'XAF',
      deposit: '120000',
    });
    createdLeaseIds.push(lease.id);
    await leases.activateLease(ownerUserId, lease.id);
    await expect(leases.cancelLease(ownerUserId, lease.id)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('listManaged paginates and filters by status', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2034-01-01T00:00:00Z'),
      endDate: new Date('2034-12-31T00:00:00Z'),
      monthlyRent: '50000',
      currency: 'XAF',
      deposit: '100000',
    });
    createdLeaseIds.push(lease.id);

    const page1 = await leases.listManaged(ownerUserId, {
      page: 1,
      pageSize: 2,
    });
    expect(page1.data.length).toBeLessThanOrEqual(2);
    expect(page1.meta.page).toBe(1);
    expect(page1.meta.pageSize).toBe(2);
    expect(page1.meta.total).toBeGreaterThanOrEqual(1);

    const drafts = await leases.listManaged(ownerUserId, {
      status: LeaseStatus.DRAFT,
      propertyId,
    });
    expect(drafts.data.every((l) => l.status === LeaseStatus.DRAFT)).toBe(true);
    expect(drafts.data.some((l) => l.id === lease.id)).toBe(true);

    const overdue = await leases.listManaged(ownerUserId, { overdue: true });
    expect(Array.isArray(overdue.data)).toBe(true);
  });

  it('LEASE_CREATED is emitted with a nullable tenantId for invited leases', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      invitedPhone: '+242070009997',
      startDate: new Date('2035-01-01T00:00:00Z'),
      endDate: new Date('2035-12-31T00:00:00Z'),
      monthlyRent: '45000',
      currency: 'XAF',
      deposit: '90000',
    });
    createdLeaseIds.push(lease.id);
    await leases.activateLease(ownerUserId, lease.id);

    const event = emittedEvents.find((e) => e.name === 'lease.created');
    expect(event).toBeDefined();
    expect((event?.payload as { leaseId: string }).leaseId).toBe(lease.id);
  });

  it('charges are added to the monthly schedule amount', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2036-01-01T00:00:00Z'),
      endDate: new Date('2036-03-31T00:00:00Z'),
      monthlyRent: '100000',
      chargesAmount: '25000',
      currency: 'XAF',
      deposit: '200000',
      dueDay: 5,
    });
    createdLeaseIds.push(lease.id);
    await leases.activateLease(ownerUserId, lease.id);

    const schedule = await prisma.rentSchedule.findMany({
      where: { leaseId: lease.id },
      orderBy: { dueDate: 'asc' },
    });
    expect(schedule).toHaveLength(4);
    // Rent lines fall on `dueDay`; the DEPOSIT line is due on the move-in day.
    const depositLine = schedule.filter((s) => s.kind === 'DEPOSIT');
    expect(depositLine).toHaveLength(1);
    expect(depositLine[0].dueDate.toISOString()).toContain('2036-01-01');
    expect(
      schedule
        .filter((s) => s.kind !== 'DEPOSIT')
        .every((s) => s.dueDate.getUTCDate() === 5),
    ).toBe(true);
    const rentLines = schedule.filter((s) => s.kind !== 'DEPOSIT');
    expect(rentLines[0].rentPart.toString()).toBe('100000');
    expect(rentLines[0].chargesPart.toString()).toBe('25000');
    expect(rentLines[0].amount.toString()).toBe('125000');
    await resetPropertyStatus();
  });
});