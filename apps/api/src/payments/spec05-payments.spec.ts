import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PaymentsService } from './payments.service';
import { CashProvider } from './providers/cash.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { RentReceiptService } from '../leases/rent-receipt.service';
import { ReceiptService } from './receipts/receipt.service';
import { R2Service } from '../media/r2.service';

/**
 * Spec 05 P0 — montant serveur, contrôle du payeur, expiration, webhooks
 * idempotents, unicité par cible et correction du placeholder
 * `PAYMENT_INITIATED`.
 */
describe('PaymentsService — spec 05 P0', () => {
  let payments: PaymentsService;
  let receipts: ReceiptService;
  let mobileMoney: MobileMoneyProvider;
  let prisma: PrismaService;
  let events: { emit: jest.Mock };
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let guestUserId: string;
  let strangerUserId: string;
  let propertyId: string;
  let leaseId: string;
  let scheduleId: string;
  let partialLeaseId: string;
  let partialScheduleId: string;
  let bookingId: string;
  const createdPaymentIds: string[] = [];
  const phones = {
    owner: '+242070000151',
    tenant: '+242070000152',
    guest: '+242070000153',
    stranger: '+242070000154',
  };

  beforeAll(async () => {
    events = { emit: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        AgencyAccessService,
        CashProvider,
        MobileMoneyProvider,
        PrismaService,
        DocumentSequenceService,
        RentReceiptService,
        ReceiptService,
        { provide: EventPublisher, useValue: events },
        {
          provide: R2Service,
          useValue: {
            uploadBuffer: jest.fn(async (key: string) => ({
              url: `https://fake.r2/${key}`,
              key,
            })),
            uploadLeaseFile: jest.fn(async (key: string) => ({
              url: `https://fake.r2/${key}`,
              key,
            })),
            createPresignedDownload: jest.fn(async (key: string) => key),
          },
        },
      ],
    }).compile();

    payments = moduleRef.get(PaymentsService);
    receipts = moduleRef.get(ReceiptService);
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

    // Purge leftovers of a previous crashed run (unique (phone, countryId)).
    const stale = await prisma.user.findMany({
      where: { phone: { in: Object.values(phones) } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.paymentAllocation.deleteMany({
        where: { payment: { userId: { in: staleIds } } },
      });
      await prisma.receipt.deleteMany({ where: { payment: { userId: { in: staleIds } } } });
      await prisma.payment.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const mk = async (phone: string, name: string) =>
      prisma.user.create({
        data: { phone, countryId, name, roles: { create: { role: 'TENANT' } } },
      });
    ownerUserId = (await mk(phones.owner, 'Spec05 Owner')).id;
    tenantUserId = (await mk(phones.tenant, 'Spec05 Tenant')).id;
    guestUserId = (await mk(phones.guest, 'Spec05 Guest')).id;
    strangerUserId = (await mk(phones.stranger, 'Spec05 Stranger')).id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec05 Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec05 Property',
          description: 'Paiements',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 150000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'Spec05',
          countryId,
          ownerId: ownerUserId,
          organizationId: org.id,
        },
      })
    ).id;

    const baseLease = {
      propertyId,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2027-01-01T00:00:00Z'),
      currency: 'XAF',
      status: 'ACTIVE',
    } as const;
    const lease = await prisma.lease.create({
      data: {
        ...baseLease,
        tenantId: tenantUserId,
        monthlyRent: 150000,
        deposit: 300000,
      },
    });
    leaseId = lease.id;
    scheduleId = (
      await prisma.rentSchedule.create({
        data: {
          leaseId,
          dueDate: new Date('2026-02-01T00:00:00Z'),
          amount: 150000,
          currency: 'XAF',
          status: 'PENDING',
        },
      })
    ).id;

    // A lease where the manager enabled partial payments (≥ 50 000).
    const partialLease = await prisma.lease.create({
      data: {
        ...baseLease,
        tenantId: tenantUserId,
        monthlyRent: 200000,
        deposit: 400000,
        allowPartialPayments: true,
        minPartialAmount: 50000,
      },
    });
    partialLeaseId = partialLease.id;
    partialScheduleId = (
      await prisma.rentSchedule.create({
        data: {
          leaseId: partialLeaseId,
          dueDate: new Date('2026-02-01T00:00:00Z'),
          amount: 200000,
          currency: 'XAF',
          status: 'PENDING',
        },
      })
    ).id;

    bookingId = (
      await prisma.booking.create({
        data: {
          propertyId,
          userId: guestUserId,
          startDate: new Date('2026-03-01T00:00:00Z'),
          endDate: new Date('2026-03-05T00:00:00Z'),
          totalPrice: 50000,
          currency: 'XAF',
          status: 'PENDING',
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (createdPaymentIds.length) {
      await prisma.paymentAllocation
        .deleteMany({ where: { paymentId: { in: createdPaymentIds } } })
        .catch(() => undefined);
      await prisma.receipt
        .deleteMany({ where: { paymentId: { in: createdPaymentIds } } })
        .catch(() => undefined);
      await prisma.payment
        .deleteMany({ where: { id: { in: createdPaymentIds } } })
        .catch(() => undefined);
    }
    await prisma.booking.delete({ where: { id: bookingId } }).catch(() => undefined);
    await prisma.paymentEvent
      .deleteMany({ where: { paymentId: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.rentSchedule
      .deleteMany({ where: { leaseId: { in: [leaseId, partialLeaseId] } } })
      .catch(() => undefined);
    await prisma.lease
      .deleteMany({ where: { id: { in: [leaseId, partialLeaseId] } } })
      .catch(() => undefined);
    const ids = [ownerUserId, tenantUserId, guestUserId, strangerUserId];
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { userId: { in: ids } } });
    await prisma.organization
      .deleteMany({ where: { members: { some: { userId: ownerUserId } } } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  it('quote returns the server-side amount due and the partial rules', async () => {
    const quote = await payments.quote(tenantUserId, 'RENT_SCHEDULE', scheduleId);
    expect(quote).toEqual({
      targetType: 'RENT_SCHEDULE',
      targetId: scheduleId,
      due: '150000',
      currency: 'XAF',
      allowPartial: false,
      minPartial: null,
    });

    const partial = await payments.quote(
      tenantUserId,
      'RENT_SCHEDULE',
      partialScheduleId,
    );
    expect(partial.allowPartial).toBe(true);
    expect(partial.minPartial).toBe('50000');
    expect(partial.due).toBe('200000');
  });

  it('AMOUNT_MISMATCH when the amount differs and partial is not allowed', async () => {
    await expect(
      payments.initiatePayment({
        userId: tenantUserId,
        amount: 100000,
        currency: 'XAF',
        method: 'MOBILE_MONEY',
        provider: 'AIRTEL',
        phone: phones.tenant,
        idempotencyKey: `spec05-mismatch-${Date.now()}`,
        rentScheduleId: scheduleId,
      }),
    ).rejects.toMatchObject({ response: { code: 'AMOUNT_MISMATCH' } });
  });

  it('NOT_PAYER when a stranger tries to settle a rent schedule', async () => {
    await expect(
      payments.initiatePayment({
        userId: strangerUserId,
        currency: 'XAF',
        method: 'MOBILE_MONEY',
        provider: 'MOMO',
        phone: phones.stranger,
        idempotencyKey: `spec05-notpayer-${Date.now()}`,
        target: { type: 'RENT_SCHEDULE', id: scheduleId },
      }),
    ).rejects.toMatchObject({
      status: 403,
      response: { code: 'NOT_PAYER' },
    });
  });

  it('an allowed partial is accepted between the minimum and the balance', async () => {
    const key = `spec05-partial-${Date.now()}`;
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: 60000,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: phones.tenant,
      idempotencyKey: key,
      rentScheduleId: partialScheduleId,
    });
    createdPaymentIds.push(payment.id);
    expect(payment.amount).toBe('60000');
    expect(payment.status).toBe('INITIATED');
    expect(payment.expiresAt).not.toBeNull();
    expect(payment.providerRef).toBe(payment.reference);

    await expect(
      payments.initiatePayment({
        userId: tenantUserId,
        amount: 40000,
        currency: 'XAF',
        method: 'MOBILE_MONEY',
        provider: 'AIRTEL',
        phone: phones.tenant,
        idempotencyKey: `${key}-below-min`,
        rentScheduleId: partialScheduleId,
      }),
    ).rejects.toMatchObject({ response: { code: 'PARTIAL_MIN_NOT_MET' } });
  });

  it('a booking target pays its totalPrice and PAYMENT_INITIATED carries the real id', async () => {
    events.emit.mockClear();

    const payment = await payments.initiatePayment({
      userId: guestUserId,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'MOMO',
      phone: phones.guest,
      idempotencyKey: `spec05-booking-${Date.now()}`,
      target: { type: 'BOOKING', id: bookingId },
    });
    createdPaymentIds.push(payment.id);

    // Server-side amount: the client did not send one.
    expect(payment.amount).toBe('50000');
    expect(payment.bookingId).toBe(bookingId);

    const initiated = events.emit.mock.calls.filter(
      (call) => call[0] === 'payment.initiated',
    );
    expect(initiated).toHaveLength(1);
    expect(initiated[0][1]).toMatchObject({
      paymentId: payment.id,
      userId: guestUserId,
      amount: '50000',
    });
    // The old placeholder emitted the booking id instead of the payment id.
    expect(initiated[0][1].paymentId).not.toBe(bookingId);

    // Another guest cannot pay someone else's booking.
    await expect(
      payments.initiatePayment({
        userId: strangerUserId,
        currency: 'XAF',
        method: 'MOBILE_MONEY',
        provider: 'MOMO',
        phone: phones.stranger,
        idempotencyKey: `spec05-booking-other-${Date.now()}`,
        target: { type: 'BOOKING', id: bookingId },
      }),
    ).rejects.toMatchObject({ response: { code: 'NOT_PAYER' } });
  });

  it('an INITIATED payment past its TTL expires and is never allocated', async () => {
    events.emit.mockClear();
    const expiryKey = `spec05-expiry-key-${Date.now()}`;
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: phones.tenant,
      idempotencyKey: expiryKey,
      rentScheduleId: scheduleId,
    });
    createdPaymentIds.push(payment.id);
    expect(payment.expiresAt).not.toBeNull();

    // The cron polls the provider first (sandbox stub → still pending) and
    // then expires the payment.
    const result = await payments.expireDuePayments(
      new Date(Date.now() + 16 * 60_000),
    );
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const row = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { allocations: true },
    });
    expect(row.status).toBe('EXPIRED');
    expect(row.allocations).toHaveLength(0);
    expect(row.failureReason).toBe('EXPIRED_AFTER_15_MIN');

    const emitted = events.emit.mock.calls.map((call) => call[0]);
    expect(emitted).toContain('payment.expired');

    // Journal: initiate request/response + the expiry status poll.
    const kinds = await prisma.paymentEvent.findMany({
      where: { paymentId: payment.id },
      select: { kind: true },
    });
    expect(kinds.map((k) => k.kind)).toEqual(
      expect.arrayContaining(['INITIATE_REQUEST', 'INITIATE_RESPONSE', 'STATUS_POLL']),
    );

    // A later attempt with the same key revives the row (mobile retry).
    const retry = await payments.initiatePayment({
      userId: tenantUserId,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: phones.tenant,
      idempotencyKey: expiryKey,
      rentScheduleId: scheduleId,
    });
    createdPaymentIds.push(retry.id);
    expect(retry.id).toBe(payment.id);
    expect(retry.status).toBe('INITIATED');
    expect(retry.reference).not.toBe(payment.reference);
  });

  it('only one INITIATED mobile money payment exists per target', async () => {
    const target = { type: 'RENT_SCHEDULE' as const, id: scheduleId };
    const first = await payments.initiatePayment({
      userId: tenantUserId,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: phones.tenant,
      idempotencyKey: `spec05-unique-1-${Date.now()}`,
      target,
    });
    createdPaymentIds.push(first.id);
    const second = await payments.initiatePayment({
      userId: tenantUserId,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: phones.tenant,
      idempotencyKey: `spec05-unique-2-${Date.now()}`,
      target,
    });
    createdPaymentIds.push(second.id);

    expect(second.id).not.toBe(first.id);
    const previous = await prisma.payment.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(previous.status).toBe('CANCELLED');

    // The payer can cancel the pending attempt; a stranger cannot.
    await payments.cancelPayment(tenantUserId, second.id);
    const cancelled = await prisma.payment.findUniqueOrThrow({
      where: { id: second.id },
    });
    expect(cancelled.status).toBe('CANCELLED');
    await expect(payments.cancelPayment(tenantUserId, second.id)).rejects.toMatchObject({
      response: { code: 'PAYMENT_NOT_CANCELLABLE' },
    });
    await expect(payments.cancelPayment(strangerUserId, second.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('status polling keeps an unconfirmed sandbox payment INITIATED', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'MOMO',
      phone: phones.tenant,
      idempotencyKey: `spec05-status-${Date.now()}`,
      rentScheduleId: scheduleId,
    });
    createdPaymentIds.push(payment.id);

    const status = await payments.getPaymentStatus(tenantUserId, payment.id);
    expect(status.status).toBe('INITIATED');
    const polls = await prisma.paymentEvent.count({
      where: { paymentId: payment.id, kind: 'STATUS_POLL' },
    });
    expect(polls).toBeGreaterThanOrEqual(1);
  });

  it('two identical webhooks allocate once and validate once', async () => {
    events.emit.mockClear();
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: phones.tenant,
      idempotencyKey: `spec05-webhook-${Date.now()}`,
      rentScheduleId: scheduleId,
    });
    createdPaymentIds.push(payment.id);

    const raw = JSON.stringify({
      reference: payment.reference,
      status: 'SUCCESS',
    });
    const signature = mobileMoney.signPayload(raw);

    const first = await payments.handleMobileMoneyWebhook(raw, signature);
    expect(first.status).toBe('VALIDATED');
    expect(first.allocations).toHaveLength(1);

    const second = await payments.handleMobileMoneyWebhook(raw, signature);
    expect(second.status).toBe('VALIDATED');
    expect(second.allocations).toHaveLength(1);

    const allocations = await prisma.paymentAllocation.count({
      where: { paymentId: payment.id },
    });
    expect(allocations).toBe(1);

    const emissions = events.emit.mock.calls.filter(
      (call) => call[0] === 'payment.validated',
    );
    expect(emissions).toHaveLength(1);

    const schedule = await prisma.rentSchedule.findUniqueOrThrow({
      where: { id: scheduleId },
    });
    expect(schedule.status).toBe('PAID');
    expect(schedule.amountPaid.toString()).toBe('150000');

    // One receipt even when the receipt is generated twice (idempotent).
    await receipts.generateForPayment(payment.id);
    await receipts.generateForPayment(payment.id);
    const receiptCount = await prisma.receipt.count({
      where: { paymentId: payment.id },
    });
    expect(receiptCount).toBe(1);
  });

  it('the adapted Airtel webhook rejects a bad signature and journals the payload', async () => {
    // The previous test settled this line: reopen it for a fresh payment.
    await prisma.paymentAllocation.deleteMany({ where: { rentScheduleId: scheduleId } });
    await prisma.rentSchedule.update({
      where: { id: scheduleId },
      data: { status: 'PENDING', amountPaid: 0 },
    });
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      currency: 'XAF',
      method: 'MOBILE_MONEY',
      provider: 'AIRTEL',
      phone: phones.tenant,
      idempotencyKey: `spec05-airtelwh-${Date.now()}`,
      rentScheduleId: scheduleId,
    });
    createdPaymentIds.push(payment.id);

    const raw = JSON.stringify({
      transaction: { id: payment.reference, status_code: 'TS' },
    });

    await expect(
      payments.handleProviderWebhook('AIRTEL', raw, 'bad-signature', undefined),
    ).rejects.toMatchObject({ response: { code: 'WEBHOOK_REJECTED' } });
    const rejected = await prisma.paymentEvent.findFirst({
      where: { paymentId: payment.id, kind: 'WEBHOOK', signatureValid: false },
    });
    expect(rejected).not.toBeNull();

    const signature = mobileMoney.signPayload(raw);
    const settled = await payments.handleProviderWebhook(
      'AIRTEL',
      raw,
      signature,
      undefined,
    );
    expect(settled.status).toBe('VALIDATED');
    expect(settled.allocations).toHaveLength(1);

    // A replay of the same webhook changes nothing (providerRef idempotent).
    const replay = await payments.handleProviderWebhook(
      'AIRTEL',
      raw,
      signature,
      undefined,
    );
    expect(replay.status).toBe('VALIDATED');
    expect(replay.allocations).toHaveLength(1);
  });

  it('a targetless payment keeps accepting an explicit amount (legacy client)', async () => {
    const payment = await payments.initiatePayment({
      userId: tenantUserId,
      amount: 25000,
      currency: 'XAF',
      method: 'CASH',
      idempotencyKey: `spec05-legacy-${Date.now()}`,
    });
    createdPaymentIds.push(payment.id);
    expect(payment.status).toBe('PENDING_VALIDATION');
    expect(payment.amount).toBe('25000');

    await expect(
      payments.initiatePayment({
        userId: tenantUserId,
        amount: 0,
        currency: 'XAF',
        method: 'CASH',
        idempotencyKey: `spec05-legacy-zero-${Date.now()}`,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
