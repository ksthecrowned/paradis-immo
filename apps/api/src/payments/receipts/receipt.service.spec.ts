import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { EventPublisher } from '../../events/event.publisher';
import { R2Service } from '../../media/r2.service';
import { ReceiptService } from './receipt.service';

describe('ReceiptService', () => {
  let receipts: ReceiptService;
  let prisma: PrismaService;
  let uploadSpy: jest.Mock;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let agentUserId: string;
  let tenantUserId: string;
  let propertyId: string;
  let leaseId: string;
  let rentScheduleId: string;
  let paymentId: string;
  let ownerOrgId: string;
  let agentOrgId: string;
  const createdReceiptIds: string[] = [];
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    uploadSpy = jest.fn(
      (key: string) =>
        Promise.resolve({ url: `https://fake.r2/${key}` }) as Promise<{
          url: string;
        }>,
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReceiptService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
        {
          provide: R2Service,
          useValue: { uploadBuffer: uploadSpy },
        },
      ],
    }).compile();
    receipts = moduleRef.get(ReceiptService);
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
        where: {
          phone: { in: ['+242074444441', '+242074444442', '+242074444443'] },
        },
        select: { id: true },
      })
    ).map((u) => u.id);
    if (userIds.length > 0) {
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
        phone: '+242074444441',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const agent = await prisma.user.create({
      data: {
        phone: '+242074444442',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    agentUserId = agent.id;
    const tenant = await prisma.user.create({
      data: {
        phone: '+242074444443',
        countryId,
        name: 'Jean KOUKA',
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Receipt Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;
    const agentOrg = await prisma.organization.create({
      data: {
        name: `Receipt Test Agent ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: agentUserId, role: 'AGENT' } },
      },
    });
    agentOrgId = agentOrg.id;
    const prop = await prisma.property.create({
      data: {
        title: 'Receipt Test Property',
        description: 'Pour tester les reçus',
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

    // Pre-validated payment so the receipt can resolve a tenant + allocations.
    const payment = await prisma.payment.create({
      data: {
        userId: tenantUserId,
        amount: new Prisma.Decimal(200000),
        currency: 'XAF',
        method: 'CASH',
        status: 'VALIDATED',
        reference: `rec-pay-${Date.now()}`,
        idempotencyKey: `rec-idem-${Date.now()}`,
        validatedBy: agentUserId,
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
    createdPaymentIds.push(paymentId);
  });

  afterAll(async () => {
    if (createdReceiptIds.length) {
      await prisma.receipt
        .deleteMany({ where: { id: { in: createdReceiptIds } } })
        .catch(() => undefined);
    }
    await prisma.receipt
      .deleteMany({
        where: {
          payment: { userId: { in: [ownerUserId, agentUserId, tenantUserId] } },
        },
      })
      .catch(() => undefined);
    if (createdPaymentIds.length) {
      await prisma.paymentAllocation
        .deleteMany({ where: { paymentId: { in: createdPaymentIds } } })
        .catch(() => undefined);
      await prisma.payment
        .deleteMany({ where: { id: { in: createdPaymentIds } } })
        .catch(() => undefined);
    }
    if (rentScheduleId) {
      await prisma.paymentAllocation
        .deleteMany({
          where: { rentSchedule: { id: rentScheduleId } },
        })
        .catch(() => undefined);
      await prisma.rentSchedule
        .delete({ where: { id: rentScheduleId } })
        .catch(() => undefined);
    }
    if (leaseId) {
      await prisma.lease
        .delete({ where: { id: leaseId } })
        .catch(() => undefined);
    }
    if (propertyId) {
      await prisma.property
        .delete({ where: { id: propertyId } })
        .catch(() => undefined);
    }
    await prisma.property
      .deleteMany({
        where: { organizationId: { in: [ownerOrgId, agentOrgId] } },
      })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, agentUserId, tenantUserId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [ownerOrgId, agentOrgId] } },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, agentUserId, tenantUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, agentUserId, tenantUserId] } },
    });
    await prisma.onModuleDestroy();
  });

  beforeEach(() => {
    createdReceiptIds.length = 0;
    uploadSpy.mockClear();
  });

  it('generates a receipt with a PDF buffer uploaded to R2 and a Receipt row', async () => {
    const result = await receipts.generateForPayment(paymentId);
    createdReceiptIds.push(result.receiptId);

    expect(result.url).toMatch(/^https:\/\/fake\.r2\/receipts\//);
    expect(result.number).toMatch(/^REC-/);
    expect(uploadSpy).toHaveBeenCalledTimes(1);

    const callArgs = uploadSpy.mock.calls[0] as [string, Buffer, string];
    const [key, body, contentType] = callArgs;
    expect(key).toMatch(new RegExp(`^receipts/${paymentId}/REC-.*\\.pdf$`));
    expect(body.length).toBeGreaterThan(200);
    expect(body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    expect(contentType).toBe('application/pdf');

    const persisted = await prisma.receipt.findUnique({
      where: { id: result.receiptId },
    });
    expect(persisted?.paymentId).toBe(paymentId);
    expect(persisted?.number).toBe(result.number);
  });

  it('is idempotent on paymentId — re-running returns the same receipt without re-uploading', async () => {
    const first = await receipts.generateForPayment(paymentId);
    const callsAfterFirst = uploadSpy.mock.calls.length;
    const second = await receipts.generateForPayment(paymentId);

    expect(second.receiptId).toBe(first.receiptId);
    expect(second.number).toBe(first.number);
    expect(second.url).toBe(first.url);
    expect(uploadSpy.mock.calls.length).toBe(callsAfterFirst);
  });
});
