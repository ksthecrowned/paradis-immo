import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { R2Service } from '../media/r2.service';
import { InfobipService } from './infobip.service';
import { FcmService } from './fcm.service';
import { NotificationsService } from './notifications.service';
import { ReceiptService } from '../payments/receipts/receipt.service';
import { PaymentValidatedProcessor } from './processors/payment-validated.processor';

describe('Notifications — PAYMENT_VALIDATED processor', () => {
  let processor: PaymentValidatedProcessor;
  let notifications: NotificationsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let ownerOrgId: string;
  let propertyId: string;
  let leaseId: string;
  let rentScheduleId: string;
  let paymentId: string;
  const sentWhatsApp: Array<{ phone: string; message: string }> = [];
  const createdNotificationIds: string[] = [];
  const createdReceiptIds: string[] = [];

  beforeAll(async () => {
    const uploadSpy = jest.fn(
      (key: string) =>
        Promise.resolve({ url: `https://fake.r2/${key}` }) as Promise<{
          url: string;
        }>,
    );
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
        PaymentValidatedProcessor,
        NotificationsService,
        ReceiptService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
        { provide: R2Service, useValue: { uploadBuffer: uploadSpy } },
        { provide: InfobipService, useValue: infobip },
        { provide: FcmService, useValue: fcm },
      ],
    }).compile();
    processor = moduleRef.get(PaymentValidatedProcessor);
    notifications = moduleRef.get(NotificationsService);
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
        where: { phone: { in: ['+242078888881', '+242078888882'] } },
        select: { id: true },
      })
    ).map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.notification
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.receipt
        .deleteMany({ where: { payment: { userId: { in: userIds } } } })
        .catch(() => undefined);
      await prisma.paymentAllocation
        .deleteMany({ where: { payment: { userId: { in: userIds } } } })
        .catch(() => undefined);
      await prisma.payment
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const owner = await prisma.user.create({
      data: {
        phone: '+242078888881',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const tenant = await prisma.user.create({
      data: {
        phone: '+242078888882',
        countryId,
        name: 'Marie PAYEUR',
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Notif Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Notif Test Property',
        description: 'Pour tester les notifications',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 200000,
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
        endDate: new Date('2026-09-01T00:00:00Z'),
        monthlyRent: new Prisma.Decimal(200000),
        deposit: new Prisma.Decimal(400000),
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    leaseId = lease.id;

    const rentSchedule = await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date('2026-07-01T00:00:00Z'),
        amount: new Prisma.Decimal(200000),
        currency: 'XAF',
        status: 'PENDING',
      },
    });
    rentScheduleId = rentSchedule.id;

    const payment = await prisma.payment.create({
      data: {
        userId: tenantUserId,
        amount: new Prisma.Decimal(200000),
        currency: 'XAF',
        method: 'CASH',
        status: 'VALIDATED',
        reference: `notif-pay-${Date.now()}`,
        idempotencyKey: `notif-idem-${Date.now()}`,
        validatedBy: ownerUserId,
        validatedAt: new Date('2026-07-02T10:00:00Z'),
        allocations: {
          create: [
            {
              type: 'RENT_SCHEDULE',
              refId: rentScheduleId,
              amount: new Prisma.Decimal(200000),
              rentScheduleId,
            },
          ],
        },
      },
    });
    paymentId = payment.id;
  });

  afterAll(async () => {
    if (createdNotificationIds.length) {
      await prisma.notification
        .deleteMany({ where: { id: { in: createdNotificationIds } } })
        .catch(() => undefined);
    }
    if (createdReceiptIds.length) {
      await prisma.receipt
        .deleteMany({ where: { id: { in: createdReceiptIds } } })
        .catch(() => undefined);
    }
    await prisma.receipt
      .deleteMany({
        where: {
          payment: { userId: { in: [ownerUserId, tenantUserId] } },
        },
      })
      .catch(() => undefined);
    await prisma.paymentAllocation
      .deleteMany({
        where: { payment: { userId: { in: [ownerUserId, tenantUserId] } } },
      })
      .catch(() => undefined);
    await prisma.payment
      .deleteMany({ where: { userId: { in: [ownerUserId, tenantUserId] } } })
      .catch(() => undefined);
    await prisma.rentSchedule
      .delete({ where: { id: rentScheduleId } })
      .catch(() => undefined);
    await prisma.lease
      .delete({ where: { id: leaseId } })
      .catch(() => undefined);
    await prisma.property
      .delete({ where: { id: propertyId } })
      .catch(() => undefined);
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

  it('PAYMENT_VALIDATED handler sends WhatsApp with receipt URL to tenant', async () => {
    const result = await processor.handlePaymentValidated(
      paymentId,
      tenantUserId,
    );

    expect(result.sent).toBe(true);

    expect(sentWhatsApp).toHaveLength(1);
    expect(sentWhatsApp[0].phone).toBe('+242078888882');
    // The message must mention the receipt URL (which is the R2 fake URL)
    expect(sentWhatsApp[0].message).toMatch(/https:\/\/fake\.r2\/receipts\//);
    expect(sentWhatsApp[0].message).toContain('Paradis Immo');

    // A Notification row was persisted with PAYMENT_RECEIPT_READY + receiptUrl
    const rows = await notifications.listForUser(tenantUserId);
    const ours = rows.filter(
      (n) => n.type === 'PAYMENT_RECEIPT_READY' && n.status === 'SENT',
    );
    expect(ours.length).toBeGreaterThanOrEqual(1);
    createdNotificationIds.push(...ours.map((n) => n.id));
    createdReceiptIds.push(
      ...(
        await prisma.receipt.findMany({
          where: { paymentId },
          select: { id: true },
        })
      ).map((r) => r.id),
    );
  });

  it('listForUser returns notifications newest first', async () => {
    const rows = await notifications.listForUser(tenantUserId);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].createdAt >= rows[i].createdAt).toBe(true);
    }
  });
});
