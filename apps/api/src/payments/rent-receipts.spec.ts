import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { EventPublisher } from '../events/event.publisher';
import { CashProvider } from './providers/cash.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';
import { PaymentsService } from './payments.service';
import { DocumentSequenceService } from '../documents/document-sequence.service';
import { RentReceiptService } from '../leases/rent-receipt.service';
import { R2Service } from '../media/r2.service';
import { ReceiptService } from './receipts/receipt.service';
import { UsersService } from '../users/users.service';

/**
 * Spec 04 P1 — PARTIAL payments and sequential rent receipts:
 * - a 100 000 payment on a 150 000 line leaves it PARTIAL with
 *   `amountPaid = 100000`, no quittance;
 * - settling the balance flips it to PAID and issues the quittance;
 * - quittance numbers are strictly consecutive per organization and year.
 */
describe('Rent receipts + PARTIAL payments (spec 04 P1)', () => {
  let prisma: PrismaService;
  let payments: PaymentsService;
  let sequences: DocumentSequenceService;
  let receipts: RentReceiptService;
  let paymentReceipts: ReceiptService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let propertyId: string;
  let leaseId: string;
  let rentScheduleId: string;
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    const uploaded: string[] = [];
    const r2 = {
      uploadBuffer: jest.fn(async (key: string) => {
        uploaded.push(key);
        return { url: `https://fake.r2/${key}`, key };
      }),
      createPresignedDownload: jest.fn(async (key: string) => key),
    } as unknown as R2Service;

    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        PaymentsService,
        DocumentSequenceService,
        RentReceiptService,
        ReceiptService,
        AgencyAccessService,
        UsersService,
        { provide: R2Service, useValue: r2 },
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
        {
          provide: CashProvider,
          useValue: {
            initiate: jest.fn(async () => ({
              reference: `CASH-${Date.now()}-${Math.random()}`,
            })),
          },
        },
        {
          provide: MobileMoneyProvider,
          useValue: { initiate: jest.fn() },
        },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    payments = moduleRef.get(PaymentsService);
    sequences = moduleRef.get(DocumentSequenceService);
    receipts = moduleRef.get(RentReceiptService);
    paymentReceipts = moduleRef.get(ReceiptService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    const phones = ['+242070000031', '+242070000032'];
    await prisma.user.deleteMany({ where: { phone: { in: phones } } });
    const owner = await prisma.user.create({
      data: {
        phone: phones[0],
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const tenant = await prisma.user.create({
      data: {
        phone: phones[1],
        countryId,
        name: 'Locataire Spec04 P1',
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec04 P1 Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const prop = await prisma.property.create({
      data: {
        title: 'Spec04 P1 Property',
        description: 'Quittances et paiements partiels',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'Spec04 P1',
        countryId,
        ownerId: ownerUserId,
        organizationId: org.id,
      },
    });
    propertyId = prop.id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2030-01-05T00:00:00Z'),
        endDate: new Date('2030-02-28T00:00:00Z'),
        monthlyRent: new Prisma.Decimal(150000),
        deposit: new Prisma.Decimal(300000),
        currency: 'XAF',
        status: 'ACTIVE',
        dueDay: 5,
      },
    });
    leaseId = lease.id;
    const schedule = await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date('2030-01-05T00:00:00Z'),
        amount: new Prisma.Decimal(150000),
        currency: 'XAF',
        rentPart: new Prisma.Decimal(150000),
        periodStart: new Date('2030-01-05T00:00:00Z'),
        periodEnd: new Date('2030-01-31T00:00:00Z'),
      },
    });
    rentScheduleId = schedule.id;
  });

  afterAll(async () => {
    if (createdPaymentIds.length) {
      await prisma.receipt.deleteMany({
        where: { paymentId: { in: createdPaymentIds } },
      });
      await prisma.paymentAllocation.deleteMany({
        where: { paymentId: { in: createdPaymentIds } },
      });
      await prisma.payment.deleteMany({
        where: { id: { in: createdPaymentIds } },
      });
    }
    await prisma.rentReceipt
      .deleteMany({ where: { rentScheduleId } })
      .catch(() => undefined);
    await prisma.rentSchedule.deleteMany({ where: { leaseId } });
    await prisma.lease.deleteMany({ where: { id: leaseId } });
    await prisma.documentSequence.deleteMany({ where: { organizationId: { startsWith: 'org-' } } });
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId] } },
    });
    await prisma.organization.deleteMany({
      where: { members: { some: { userId: { in: [ownerUserId, tenantUserId] } } } },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, tenantUserId] } },
    });
    await prisma.onModuleDestroy();
  });

  it('a partial payment leaves the line PARTIAL and issues no quittance', async () => {
    const payment = await payments.recordCashForRentSchedule(
      ownerUserId,
      {
        rentScheduleId,
        amount: 100000,
        idempotencyKey: `spec04-partial-${Date.now()}`,
      },
    );
    createdPaymentIds.push(payment.id);

    const schedule = await prisma.rentSchedule.findUniqueOrThrow({
      where: { id: rentScheduleId },
    });
    expect(schedule.status).toBe('PARTIAL');
    expect(schedule.amountPaid.toString()).toBe('100000');
    expect(
      await prisma.rentReceipt.count({ where: { rentScheduleId } }),
    ).toBe(0);
    await expect(
      receipts.issueForRentSchedule(rentScheduleId),
    ).rejects.toMatchObject({
      response: { code: 'RENT_SCHEDULE_NOT_PAID' },
    });
  });

  it('every payment (even partial) gets a sequential R- receipt', async () => {
    const paymentId = createdPaymentIds[0];
    const orgId = (
      await prisma.property.findUniqueOrThrow({
        where: { id: propertyId },
        select: { organizationId: true },
      })
    ).organizationId;
    const before = await sequences.peek(orgId, 'RECEIPT');

    const generated = await paymentReceipts.generateForPayment(paymentId);
    expect(generated.number).toMatch(/^R-[A-Z0-9]+-\d{4}-\d{6}$/);
    expect(generated.number.endsWith(String(before + 1).padStart(6, '0'))).toBe(
      true,
    );
    expect(generated.url).toContain('https://fake.r2/');

    // Idempotent on paymentId: same number, no sequence burn.
    const again = await paymentReceipts.generateForPayment(paymentId);
    expect(again.number).toBe(generated.number);
    expect(await sequences.peek(orgId, 'RECEIPT')).toBe(before + 1);
  });

  it('settling the balance issues a consecutively numbered quittance', async () => {
    const before = await sequences.peek(
      (
        await prisma.property.findUniqueOrThrow({
          where: { id: propertyId },
          select: { organizationId: true },
        })
      ).organizationId,
      'QUITTANCE',
    );

    const payment = await payments.recordCashForRentSchedule(
      ownerUserId,
      {
        rentScheduleId,
        amount: 50000,
        idempotencyKey: `spec04-settle-${Date.now()}`,
      },
    );
    createdPaymentIds.push(payment.id);

    const schedule = await prisma.rentSchedule.findUniqueOrThrow({
      where: { id: rentScheduleId },
    });
    expect(schedule.status).toBe('PAID');
    expect(schedule.amountPaid.toString()).toBe('150000');

    const receipt = await prisma.rentReceipt.findUniqueOrThrow({
      where: { rentScheduleId },
    });
    expect(receipt.number).toMatch(/^Q-[A-Z0-9]+-\d{4}-\d{6}$/);
    expect(receipt.number.endsWith(String(before + 1).padStart(6, '0'))).toBe(
      true,
    );

    // Idempotent: re-issuing returns the same number, no gap in the sequence.
    const again = await receipts.issueForRentSchedule(rentScheduleId);
    expect(again.number).toBe(receipt.number);
    const after = await sequences.peek(
      (
        await prisma.property.findUniqueOrThrow({
          where: { id: propertyId },
          select: { organizationId: true },
        })
      ).organizationId,
      'QUITTANCE',
    );
    expect(after).toBe(before + 1);
  });

  it('concurrent issuances get strictly consecutive numbers', async () => {
    const orgId = (
      await prisma.property.findUniqueOrThrow({
        where: { id: propertyId },
        select: { organizationId: true },
      })
    ).organizationId;
    const before = await sequences.peek(orgId, 'QUITTANCE');

    const numbers = await Promise.all(
      [0, 1, 2, 3, 4].map((i) =>
        prisma.$transaction((tx) =>
          sequences.nextNumber(tx, {
            organizationId: orgId,
            kind: 'QUITTANCE',
            prefix: 'Q',
          }),
        ),
      ),
    );
    const suffixes = numbers
      .map((n) => Number(n.slice(-6)))
      .sort((a, b) => a - b);
    expect(suffixes).toEqual([
      before + 1,
      before + 2,
      before + 3,
      before + 4,
      before + 5,
    ]);
    expect(new Set(numbers).size).toBe(5);
  });
});