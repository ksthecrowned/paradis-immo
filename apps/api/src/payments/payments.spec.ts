import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MessageChannel,
  MessageChargeStatus,
  MessagePayerType,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { MessagingBillingService } from '../messaging/messaging-billing.service';
import { PaymentsService } from './payments.service';
import { CashProvider } from './providers/cash.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';

describe('PaymentsService', () => {
  let payments: PaymentsService;
  // Cash provider is registered but not directly inspected in these tests.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let cash: CashProvider;
  let mobileMoney: MobileMoneyProvider;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let agentUserId: string;
  let tenantUserId: string;
  let propertyId: string;
  let leaseId: string;
  let rentScheduleId: string;
  let ownerOrgId: string;
  let agentOrgId: string;
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    process.env.USD_TO_XAF = process.env.USD_TO_XAF || '600';
    process.env.OTP_FREE_PER_MONTH = process.env.OTP_FREE_PER_MONTH || '10';
    process.env.OTP_UNIT_USD = process.env.OTP_UNIT_USD || '0.006';

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        CashProvider,
        MobileMoneyProvider,
        MessagingBillingService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    payments = moduleRef.get(PaymentsService);
    cash = moduleRef.get(CashProvider);
    mobileMoney = moduleRef.get(MobileMoneyProvider);
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

    // Belt-and-suspenders cleanup: remove anything left over from previous
    // crashed runs (FK chain on User is RESTRICT).
    const userIds = (
      await prisma.user.findMany({
        where: {
          phone: { in: ['+242071111111', '+242072222222', '+242073333334'] },
        },
        select: { id: true },
      })
    ).map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.messageCharge.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { payerId: { in: userIds } }] },
      });
      await prisma.paymentAllocation.deleteMany({
        where: { payment: { userId: { in: userIds } } },
      });
      await prisma.payment.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const owner = await prisma.user.create({
      data: {
        phone: '+242071111111',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const agent = await prisma.user.create({
      data: {
        phone: '+242072222222',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    agentUserId = agent.id;
    const tenant = await prisma.user.create({
      data: {
        phone: '+242073333334',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Payment Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;
    const agentOrg = await prisma.organization.create({
      data: {
        name: `Payment Test Agent ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: agentUserId, role: 'AGENT' } },
      },
    });
    agentOrgId = agentOrg.id;
    const prop = await prisma.property.create({
      data: {
        title: 'Payment Test',
        description: 'Pour tester les paiements',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: agentOrgId,
      },
    });
    propertyId = prop.id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-03-01T00:00:00Z'),
        monthlyRent: new Prisma.Decimal(150000),
        deposit: new Prisma.Decimal(300000),
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    leaseId = lease.id;

    const rentSchedule = await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date('2026-01-01T00:00:00Z'),
        amount: new Prisma.Decimal(150000),
        currency: 'XAF',
        status: 'PENDING',
      },
    });
    rentScheduleId = rentSchedule.id;
  });

  afterAll(async () => {
    // Belt-and-suspenders: drop anything tied to our three test users that
    // may have been left over from a previous crashed run. Done BEFORE the
    // tracked-only cleanup below so user deletion is unblocked.
    const cleanupUserIds = [ownerUserId, agentUserId, tenantUserId].filter(
      (x): x is string => Boolean(x),
    );
    if (cleanupUserIds.length > 0) {
      await prisma.messageCharge
        .deleteMany({
          where: {
            OR: [
              { userId: { in: cleanupUserIds } },
              { payerId: { in: cleanupUserIds } },
            ],
          },
        })
        .catch(() => undefined);
      await prisma.paymentAllocation
        .deleteMany({ where: { payment: { userId: { in: cleanupUserIds } } } })
        .catch(() => undefined);
      await prisma.payment
        .deleteMany({ where: { userId: { in: cleanupUserIds } } })
        .catch(() => undefined);
    }
    if (createdPaymentIds.length) {
      await prisma.paymentAllocation
        .deleteMany({ where: { paymentId: { in: createdPaymentIds } } })
        .catch(() => undefined);
      await prisma.payment
        .deleteMany({ where: { id: { in: createdPaymentIds } } })
        .catch(() => undefined);
    }
    await prisma.rentSchedule
      .deleteMany({ where: { leaseId } })
      .catch(() => undefined);
    if (leaseId) {
      await prisma.paymentAllocation
        .deleteMany({ where: { rentSchedule: { leaseId } } })
        .catch(() => undefined);
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
    // Remove any leftover properties referencing the two test orgs.
    await prisma.property
      .deleteMany({
        where: { organizationId: { in: [ownerOrgId, agentOrgId] } },
      })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: cleanupUserIds } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [ownerOrgId, agentOrgId] } },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: cleanupUserIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: cleanupUserIds } } });
    await prisma.onModuleDestroy();
  });

  beforeEach(() => {
    createdPaymentIds.length = 0;
  });

  it('initiates a cash payment in PENDING_VALIDATION', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-1`,
    });
    createdPaymentIds.push(payment.id);

    expect(payment.status).toBe('PENDING_VALIDATION');
    expect(payment.method).toBe('CASH');
    expect(payment.provider).toBeNull();
  });

  it('initiatePayment stores rentScheduleId in metadata without allocations', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-meta-sched`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    expect(payment.status).toBe('PENDING_VALIDATION');
    expect(payment.allocations).toHaveLength(0);

    const row = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    const meta = (row.metadata ?? {}) as { rentScheduleId?: string };
    expect(meta.rentScheduleId).toBe(rentScheduleId);
  });

  it('initiatePayment rejects unknown rentScheduleId', async () => {
    await expect(
      payments.initiatePayment({
        userId: tenantUserId,
        amount: '150000',
        currency: 'XAF',
        method: 'CASH',
        idempotencyKey: `cash-${Date.now()}-bad-sched`,
        rentScheduleId: '00000000-0000-0000-0000-000000000099',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('agent validates cash payment → VALIDATED + emits PAYMENT_VALIDATED', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-2`,
    });
    createdPaymentIds.push(payment.id);

    const validated = await payments.validateCashPayment(
      agentUserId,
      payment.id,
      [
        {
          type: 'RENT_SCHEDULE',
          refId: rentScheduleId,
          amount: '150000',
          rentScheduleId,
        },
      ],
    );
    expect(validated.status).toBe('VALIDATED');
    expect(validated.validatedBy).toBe(agentUserId);
    expect(validated.allocations).toHaveLength(1);
    expect(validated.allocations[0].rentScheduleId).toBe(rentScheduleId);

    // The matching rent schedule is now PAID.
    const schedule = await prisma.rentSchedule.findUnique({
      where: { id: rentScheduleId },
    });
    expect(schedule?.status).toBe('PAID');
  });

  it('owner validates cash with empty allocations using metadata.rentScheduleId', async () => {
    // Reset schedule to PENDING if previous test marked it PAID.
    await prisma.rentSchedule.update({
      where: { id: rentScheduleId },
      data: { status: 'PENDING' },
    });
    await prisma.paymentAllocation.deleteMany({
      where: { rentScheduleId },
    });

    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-owner-meta`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const validated = await payments.validateCashPayment(
      ownerUserId,
      payment.id,
      [],
    );
    expect(validated.status).toBe('VALIDATED');
    expect(validated.validatedBy).toBe(ownerUserId);
    expect(
      validated.allocations.some((a) => a.rentScheduleId === rentScheduleId),
    ).toBe(true);
  });

  it('validateCashPayment without allocations or metadata rejects with BadRequest', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-no-alloc`,
    });
    createdPaymentIds.push(payment.id);

    await expect(
      payments.validateCashPayment(ownerUserId, payment.id, []),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lists cash payments awaiting manual validation', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '50000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-pending-list`,
    });
    createdPaymentIds.push(payment.id);

    const pending = await payments.listPendingValidation();
    expect(pending.some((p) => p.id === payment.id)).toBe(true);
    pending.forEach((p) => {
      expect(p.method).toBe('CASH');
      expect(p.status).toBe('PENDING_VALIDATION');
    });
  });

  it('idempotency: same key returns the original payment (no duplicate)', async () => {
    const key = `idem-${Date.now()}`;
    const first = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: '+242073333334',
      idempotencyKey: key,
    });
    createdPaymentIds.push(first.id);

    const second = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: '+242073333334',
      idempotencyKey: key,
    });

    expect(second.id).toBe(first.id);
    expect(second.reference).toBe(first.reference);

    const all = await prisma.payment.findMany({
      where: { idempotencyKey: key },
    });
    expect(all).toHaveLength(1);
  });

  it('mobile-money provider signature verification accepts valid signature, rejects tampered payload', () => {
    const validPayload = JSON.stringify({
      reference: 'ref-abc',
      status: 'SUCCESS',
    });
    const sig = mobileMoney.signPayload(validPayload);
    expect(mobileMoney.verifyWebhookSignature(validPayload, sig)).toBe(true);
    expect(mobileMoney.verifyWebhookSignature(validPayload, 'tampered')).toBe(
      false,
    );
    expect(mobileMoney.verifyWebhookSignature(validPayload + 'x', sig)).toBe(
      false,
    );
  });

  it('listManaged returns payments on properties the user owns', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '75000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-managed`,
    });
    createdPaymentIds.push(payment.id);
    await payments.validateCashPayment(agentUserId, payment.id, [
      {
        type: 'RENT_SCHEDULE',
        refId: rentScheduleId,
        amount: '75000',
        rentScheduleId,
      },
    ]);

    const managed = await payments.listManaged(ownerUserId);
    expect(managed.length).toBeGreaterThan(0);
    const hit = managed.find((p) => p.id === payment.id);
    expect(hit).toBeDefined();
    expect(hit?.status).toBe('VALIDATED');
    expect(hit?.allocations.some((a) => a.rentScheduleId === rentScheduleId)).toBe(
      true,
    );
    managed.forEach((p) => {
      expect(p.id).toEqual(expect.any(String));
      expect(p.amount).toEqual(expect.any(String));
      expect(p.createdAt).toEqual(expect.any(String));
      expect(Array.isArray(p.allocations)).toBe(true);
    });
  });

  it('validateCashPayment throws ForbiddenException for unrelated user', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '10000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-forbidden`,
    });
    createdPaymentIds.push(payment.id);

    let err: unknown;
    try {
      await payments.validateCashPayment(tenantUserId, payment.id, [
        {
          type: 'RENT_SCHEDULE',
          refId: rentScheduleId,
          amount: '10000',
          rentScheduleId,
        },
      ]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(ForbiddenException);
  });

  it('listManaged excludes payments for users with no managed properties', async () => {
    const managed = await payments.listManaged(tenantUserId);
    expect(managed).toEqual([]);
  });

  it('listManaged includes pending cash linked by metadata.rentScheduleId', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-pending-managed`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const managed = await payments.listManaged(ownerUserId);
    expect(managed.some((p) => p.id === payment.id)).toBe(true);
  });

  it('getOne returns payment for owner of linked property', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-getone-owner`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const got = await payments.getOne(ownerUserId, payment.id);
    expect(got.id).toBe(payment.id);
  });

  it('getOne returns payment for the payer', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-getone-payer`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const got = await payments.getOne(tenantUserId, payment.id);
    expect(got.id).toBe(payment.id);
  });

  it('getOne forbids a stranger', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '150000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-${Date.now()}-getone-stranger`,
      rentScheduleId,
    });
    createdPaymentIds.push(payment.id);

    const stranger = await prisma.user.create({
      data: {
        phone: `+24209${String(Date.now()).slice(-7)}`,
        countryId,
        name: 'Pay Stranger',
      },
    });
    await expect(
      payments.getOne(stranger.id, payment.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await prisma.user
      .delete({ where: { id: stranger.id } })
      .catch(() => undefined);
  });

  it('initiatePayment adds OPEN messaging debt to amount and allocation metadata', async () => {
    await prisma.messageCharge.deleteMany({
      where: {
        OR: [{ userId: tenantUserId }, { payerId: tenantUserId }],
      },
    });
    const charge = await prisma.messageCharge.create({
      data: {
        channel: MessageChannel.WHATSAPP_OTP,
        payerType: MessagePayerType.USER,
        payerId: tenantUserId,
        userId: tenantUserId,
        recipientPhone: '+242073333334',
        billingMonth: '2099-06',
        unitUsd: 0.006,
        fxRate: 600,
        amountXaf: 4,
        status: MessageChargeStatus.OPEN,
        idempotencyKey: `pay-debt-init:${tenantUserId}:${Date.now()}`,
      },
    });

    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '10000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-debt-${Date.now()}`,
    });
    createdPaymentIds.push(payment.id);

    expect(payment.messagingDebtXaf).toBe(4);
    expect(payment.amount).toBe('10004');
    const row = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    const meta = row.metadata as { messagingChargeIds?: string[] };
    expect(meta.messagingChargeIds).toContain(charge.id);
  });

  it('validateCashPayment marks messaging charges SETTLED', async () => {
    await prisma.messageCharge.deleteMany({
      where: {
        OR: [{ userId: tenantUserId }, { payerId: tenantUserId }],
      },
    });
    const charge = await prisma.messageCharge.create({
      data: {
        channel: MessageChannel.WHATSAPP_OTP,
        payerType: MessagePayerType.USER,
        payerId: tenantUserId,
        userId: tenantUserId,
        recipientPhone: '+242073333334',
        billingMonth: '2099-07',
        unitUsd: 0.006,
        fxRate: 600,
        amountXaf: 4,
        status: MessageChargeStatus.OPEN,
        idempotencyKey: `pay-debt-settle:${tenantUserId}:${Date.now()}`,
      },
    });

    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '20000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-settle-${Date.now()}`,
    });
    createdPaymentIds.push(payment.id);

    const validated = await payments.validateCashPayment(
      agentUserId,
      payment.id,
      [
        {
          type: 'RENT_SCHEDULE',
          refId: rentScheduleId,
          amount: '20000',
          rentScheduleId,
        },
      ],
    );
    expect(validated.status).toBe('VALIDATED');
    expect(
      validated.allocations.some((a) => a.type === 'MESSAGING_DEBT'),
    ).toBe(true);

    const settled = await prisma.messageCharge.findUniqueOrThrow({
      where: { id: charge.id },
    });
    expect(settled.status).toBe(MessageChargeStatus.SETTLED);
    expect(settled.settledPaymentId).toBe(payment.id);
  });

  it('failed payment leaves charges OPEN', async () => {
    await prisma.messageCharge.deleteMany({
      where: {
        OR: [{ userId: tenantUserId }, { payerId: tenantUserId }],
      },
    });
    const charge = await prisma.messageCharge.create({
      data: {
        channel: MessageChannel.WHATSAPP_OTP,
        payerType: MessagePayerType.USER,
        payerId: tenantUserId,
        userId: tenantUserId,
        recipientPhone: '+242073333334',
        billingMonth: '2099-08',
        unitUsd: 0.006,
        fxRate: 600,
        amountXaf: 4,
        status: MessageChargeStatus.OPEN,
        idempotencyKey: `pay-debt-fail:${tenantUserId}:${Date.now()}`,
      },
    });

    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: '5000',
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `cash-fail-${Date.now()}`,
    });
    createdPaymentIds.push(payment.id);
    expect(payment.status).toBe('PENDING_VALIDATION');

    const stillOpen = await prisma.messageCharge.findUniqueOrThrow({
      where: { id: charge.id },
    });
    expect(stillOpen.status).toBe(MessageChargeStatus.OPEN);
    expect(stillOpen.settledPaymentId).toBeNull();
  });
});
