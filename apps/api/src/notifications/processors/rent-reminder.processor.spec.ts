import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventPublisher } from '../../events/event.publisher';
import { InfobipService } from '../infobip.service';
import { FcmService } from '../fcm.service';
import { NotificationsService } from '../notifications.service';
import {
  pickReminderTier,
  RentReminderProcessor,
} from './rent-reminder.processor';

describe('RentReminderProcessor', () => {
  let processor: RentReminderProcessor;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let ownerOrgId: string;
  let propertyId: string;
  let leaseId: string;
  const createdScheduleIds: string[] = [];
  const sentWhatsApp: Array<{ phone: string; message: string }> = [];

  beforeAll(async () => {
    const infobip: Pick<InfobipService, 'sendWhatsApp'> = {
      // eslint-disable-next-line @typescript-eslint/require-await
      sendWhatsApp: jest.fn(async (phone: string, message: string) => {
        sentWhatsApp.push({ phone, message });
        return { ok: true };
      }),
    };
    const fcm: Pick<FcmService, 'sendPush'> = {
      // eslint-disable-next-line @typescript-eslint/require-await
      sendPush: jest.fn(async () => ({ ok: false, reason: 'NOT_USED' })),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RentReminderProcessor,
        NotificationsService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
        { provide: InfobipService, useValue: infobip },
        { provide: FcmService, useValue: fcm },
      ],
    }).compile();
    processor = moduleRef.get(RentReminderProcessor);
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

    // Belt-and-suspenders cleanup
    const userIds = (
      await prisma.user.findMany({
        where: { phone: { in: ['+242079999991', '+242079999992'] } },
        select: { id: true },
      })
    ).map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.notification
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.rentSchedule
        .deleteMany({ where: { lease: { tenantId: { in: userIds } } } })
        .catch(() => undefined);
      await prisma.lease
        .deleteMany({ where: { tenantId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.property
        .deleteMany({ where: { ownerId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const owner = await prisma.user.create({
      data: {
        phone: '+242079999991',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const tenant = await prisma.user.create({
      data: {
        phone: '+242079999992',
        countryId,
        name: 'Jean LOYER',
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `RentReminder Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;

    const prop = await prisma.property.create({
      data: {
        title: 'RentReminder Property',
        description: 'Pour tester les rappels de loyer',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    propertyId = prop.id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-07-01T00:00:00Z'),
        endDate: new Date('2027-07-01T00:00:00Z'),
        monthlyRent: new Prisma.Decimal(150000),
        deposit: new Prisma.Decimal(300000),
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    leaseId = lease.id;
  });

  afterAll(async () => {
    await prisma.notification
      .deleteMany({ where: { userId: { in: [ownerUserId, tenantUserId] } } })
      .catch(() => undefined);
    if (createdScheduleIds.length) {
      await prisma.paymentAllocation
        .deleteMany({
          where: { rentScheduleId: { in: createdScheduleIds } },
        })
        .catch(() => undefined);
      await prisma.rentSchedule
        .deleteMany({ where: { id: { in: createdScheduleIds } } })
        .catch(() => undefined);
    }
    if (leaseId) {
      await prisma.rentSchedule
        .deleteMany({ where: { leaseId } })
        .catch(() => undefined);
      await prisma.lease
        .delete({ where: { id: leaseId } })
        .catch(() => undefined);
    }
    if (propertyId) {
      await prisma.property
        .delete({ where: { id: propertyId } })
        .catch(() => undefined);
    }
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId] } },
    });
    await prisma.organization
      .delete({ where: { id: ownerOrgId } })
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
    sentWhatsApp.length = 0;
  });

  describe('pickReminderTier (pure)', () => {
    const now = new Date('2026-07-01T08:00:00Z');
    it.each([
      [new Date('2026-06-24T08:00:00Z'), { days: -7, type: 'RENT_DUE_SOON' }],
      [new Date('2026-06-28T08:00:00Z'), { days: -3, type: 'RENT_DUE_SOON' }],
      [new Date('2026-06-30T08:00:00Z'), { days: -1, type: 'RENT_DUE_SOON' }],
      [new Date('2026-07-01T08:00:00Z'), { days: 0, type: 'RENT_DUE_SOON' }],
      [new Date('2026-07-02T08:00:00Z'), { days: 1, type: 'RENT_OVERDUE' }],
      [new Date('2026-07-06T08:00:00Z'), { days: 5, type: 'RENT_OVERDUE' }],
      [new Date('2026-07-16T08:00:00Z'), { days: 15, type: 'RENT_OVERDUE' }],
    ])('matches tier for dueDate %s', (due, expected) => {
      expect(pickReminderTier(due, now)).toEqual(expected);
    });

    it('returns null for an off-tier day', () => {
      // 2026-06-25 → 6 days before, no tier.
      expect(
        pickReminderTier(new Date('2026-06-25T08:00:00Z'), now),
      ).toBeNull();
    });
  });

  it('sends RENT_DUE_SOON for a schedule due in 7 days', async () => {
    sentWhatsApp.length = 0;
    // Reference day = 2026-07-01 (the "now" of the daily job). dueDate
    // 2026-06-24 → exactly 7 days before → tier J-7.
    const refNow = new Date('2026-07-01T07:00:00Z');
    const schedule = await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date('2026-06-24T07:00:00Z'),
        amount: new Prisma.Decimal(150000),
        currency: 'XAF',
        status: 'PENDING',
      },
    });
    createdScheduleIds.push(schedule.id);

    const result = await processor.runDaily(refNow, { leaseIds: [leaseId] });

    expect(result.scanned).toBeGreaterThanOrEqual(1);
    expect(result.sent).toBeGreaterThanOrEqual(1);
    expect(sentWhatsApp).toHaveLength(1);
    expect(sentWhatsApp[0].phone).toBe('+242079999992');
    expect(sentWhatsApp[0].message).toContain('échéance');
    expect(sentWhatsApp[0].message).toContain('150000');

    // Notification row exists with RENT_DUE_SOON + correct payload
    const notifications = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Notification"
      WHERE type = 'RENT_DUE_SOON'
        AND payload->>'rentScheduleId' = ${schedule.id}
    `;
    expect(notifications.length).toBe(1);

    // Schedule status unchanged (still PENDING — not overdue)
    const after = await prisma.rentSchedule.findUnique({
      where: { id: schedule.id },
    });
    expect(after?.status).toBe('PENDING');
  });

  it('flags a schedule OVERDUE and sends RENT_OVERDUE for +1 day', async () => {
    sentWhatsApp.length = 0;
    // Use a unique lease by creating a fresh tenant + lease for this test
    // so we don't trip on accumulated schedules from previous tests.
    const refNow = new Date('2026-07-02T07:00:00Z');
    const ownTenant = await prisma.user.create({
      data: {
        phone: `+2420799${Math.floor(Math.random() * 90000 + 10000)}`,
        countryId,
        name: 'LATE Tenant',
        roles: { create: { role: 'TENANT' } },
      },
    });
    const ownLease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: ownTenant.id,
        startDate: new Date('2026-07-01T00:00:00Z'),
        endDate: new Date('2027-07-01T00:00:00Z'),
        monthlyRent: new Prisma.Decimal(150000),
        deposit: new Prisma.Decimal(300000),
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    const schedule = await prisma.rentSchedule.create({
      data: {
        leaseId: ownLease.id,
        dueDate: new Date('2026-07-03T07:00:00Z'),
        amount: new Prisma.Decimal(150000),
        currency: 'XAF',
        status: 'PENDING',
      },
    });
    createdScheduleIds.push(schedule.id);

    const result = await processor.runDaily(refNow, {
      leaseIds: [ownLease.id],
    });
    expect(result.overdueFlagged).toBeGreaterThanOrEqual(1);

    const after = await prisma.rentSchedule.findUnique({
      where: { id: schedule.id },
    });
    expect(after?.status).toBe('OVERDUE');

    expect(sentWhatsApp.length).toBeGreaterThanOrEqual(1);
    const lastMessage = sentWhatsApp[sentWhatsApp.length - 1].message;
    expect(lastMessage).toContain('retard');

    const overdueNotifs = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Notification"
      WHERE type = 'RENT_OVERDUE'
        AND payload->>'rentScheduleId' = ${schedule.id}
    `;
    expect(overdueNotifs.length).toBe(1);

    // Cleanup the temp user/lease so the afterAll passes
    await prisma.notification
      .deleteMany({ where: { userId: ownTenant.id } })
      .catch(() => undefined);
    await prisma.paymentAllocation
      .deleteMany({ where: { rentSchedule: { leaseId: ownLease.id } } })
      .catch(() => undefined);
    await prisma.rentSchedule
      .deleteMany({ where: { leaseId: ownLease.id } })
      .catch(() => undefined);
    await prisma.lease
      .delete({ where: { id: ownLease.id } })
      .catch(() => undefined);
    await prisma.userRole
      .deleteMany({ where: { userId: ownTenant.id } })
      .catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({ where: { userId: ownTenant.id } })
      .catch(() => undefined);
    await prisma.user
      .delete({ where: { id: ownTenant.id } })
      .catch(() => undefined);
  });

  it('does not re-send on the same day for a schedule already reminded', async () => {
    sentWhatsApp.length = 0;
    const refNow = new Date('2026-07-01T07:00:00Z');
    // J-3 (due 3 days before) so we don't conflict with the J-7 schedule
    // created in the previous test (unique constraint on leaseId+dueDate).
    const schedule = await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date('2026-06-28T07:00:00Z'),
        amount: new Prisma.Decimal(150000),
        currency: 'XAF',
        status: 'PENDING',
      },
    });
    createdScheduleIds.push(schedule.id);

    const first = await processor.runDaily(refNow, { leaseIds: [leaseId] });
    const sentAfterFirst = sentWhatsApp.length;
    const second = await processor.runDaily(refNow, { leaseIds: [leaseId] });

    const notifs = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "Notification"
      WHERE type = 'RENT_DUE_SOON'
        AND payload->>'rentScheduleId' = ${schedule.id}
    `;
    expect(notifs.length).toBe(1);
    // The second run must not re-dispatch a message for the same schedule.
    expect(sentWhatsApp.length).toBe(sentAfterFirst);
    expect(second.sent).toBe(first.sent - 1);
  });
});
