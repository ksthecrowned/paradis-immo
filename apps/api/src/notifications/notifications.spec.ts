import { Test } from '@nestjs/testing';
import {
  MessageChannel,
  MessageChargeStatus,
  MessagePayerType,
  NotificationChannel,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { R2Service } from '../media/r2.service';
import { MessagingBillingService } from '../messaging/messaging-billing.service';
import { InfobipSmsService } from '../messaging/infobip-sms.service';
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
  const sentPush: Array<{ token: string; title: string }> = [];
  const sentSms: Array<{ to: string; text: string }> = [];
  const createdNotificationIds: string[] = [];
  const createdReceiptIds: string[] = [];

  beforeAll(async () => {
    process.env.USD_TO_XAF = process.env.USD_TO_XAF || '600';
    process.env.SMS_ALERT_UNIT_USD = process.env.SMS_ALERT_UNIT_USD || '0.234';

    const uploadSpy = jest.fn(
      (key: string) =>
        Promise.resolve({ url: `https://fake.r2/${key}` }) as Promise<{
          url: string;
        }>,
    );
    const infobip: Pick<InfobipService, 'sendWhatsApp'> = {
      sendWhatsApp: jest.fn(async () => ({ ok: false, reason: 'NOT_USED' })),
    };
    const sms: Pick<InfobipSmsService, 'send'> = {
      send: jest.fn(async (message: { to: string; text: string }) => {
        sentSms.push(message);
        return { ok: true, providerMessageId: 'sms-test-1' };
      }),
    };
    const fcm: Pick<FcmService, 'sendPush'> = {
      sendPush: jest.fn(
        async (token: string, title: string) => {
          sentPush.push({ token, title });
          return { ok: true };
        },
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentValidatedProcessor,
        NotificationsService,
        MessagingBillingService,
        ReceiptService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
        { provide: R2Service, useValue: { uploadBuffer: uploadSpy } },
        { provide: InfobipService, useValue: infobip },
        { provide: InfobipSmsService, useValue: sms },
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

    const userIds = (
      await prisma.user.findMany({
        where: { phone: { in: ['+242078888881', '+242078888882'] } },
        select: { id: true },
      })
    ).map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.messageCharge
        .deleteMany({
          where: {
            OR: [
              { userId: { in: userIds } },
              { payerId: { in: userIds } },
            ],
          },
        })
        .catch(() => undefined);
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
        fcmToken: 'fcm-tenant-token',
        notificationChannel: NotificationChannel.PUSH,
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
    await prisma.messageCharge
      .deleteMany({
        where: {
          OR: [
            { userId: { in: [ownerUserId, tenantUserId] } },
            { organizationId: ownerOrgId },
          ],
        },
      })
      .catch(() => undefined);
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
    sentPush.length = 0;
    sentSms.length = 0;
  });

  it('notification uses FCM when channel is PUSH', async () => {
    await prisma.user.update({
      where: { id: tenantUserId },
      data: { notificationChannel: NotificationChannel.PUSH },
    });

    const result = await processor.handlePaymentValidated(
      paymentId,
      tenantUserId,
    );

    expect(result.sent).toBe(true);
    expect(sentPush).toHaveLength(1);
    expect(sentPush[0].token).toBe('fcm-tenant-token');
    expect(sentSms).toHaveLength(0);

    const rows = await notifications.listForUser(tenantUserId);
    const ours = rows.filter(
      (n) => n.type === 'PAYMENT_RECEIPT_READY' && n.status === 'SENT',
    );
    expect(ours.length).toBeGreaterThanOrEqual(1);
    expect(ours[0].channel).toBe(NotificationChannel.PUSH);
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

  it('notification uses SMS path when user.notificationChannel is SMS', async () => {
    await prisma.user.update({
      where: { id: tenantUserId },
      data: { notificationChannel: NotificationChannel.SMS },
    });
    await prisma.notification.deleteMany({
      where: { userId: tenantUserId, type: 'PAYMENT_RECEIPT_READY' },
    });

    const result = await notifications.send({
      userId: tenantUserId,
      organizationId: ownerOrgId,
      type: 'PAYMENT_RECEIPT_READY',
      payload: {
        paymentId,
        receiptUrl: 'https://fake.r2/receipts/x.pdf',
        receiptNumber: 'R-1',
      },
    });

    expect(result.status).toBe('SENT');
    expect(result.channel).toBe(NotificationChannel.SMS);
    expect(sentSms).toHaveLength(1);
    expect(sentSms[0].to).toBe('+242078888882');
    expect(sentSms[0].text).toContain('https://fake.r2/receipts/');
    expect(sentPush).toHaveLength(0);

    const charge = await prisma.messageCharge.findFirst({
      where: {
        channel: MessageChannel.SMS_ALERT,
        payerId: ownerOrgId,
        userId: tenantUserId,
      },
    });
    expect(charge).not.toBeNull();
    expect(charge!.status).toBe(MessageChargeStatus.OPEN);
    expect(charge!.payerType).toBe(MessagePayerType.ORGANIZATION);
    createdNotificationIds.push(result.id);
  });

  it('listForUser returns notifications newest first', async () => {
    const rows = await notifications.listForUser(tenantUserId);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1].createdAt >= rows[i].createdAt).toBe(true);
    }
  });
});
