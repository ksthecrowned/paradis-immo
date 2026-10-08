import { Test } from '@nestjs/testing';
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
 * Spec 05 P2 — double validation espèces (`org.requireDualCashValidation` :
 * le registraire ne peut pas valider son propre enregistrement) et export
 * CSV du portefeuille géré (`payments/managed/export.csv`).
 */
describe('PaymentsService — spec 05 P2 (double validation & export CSV)', () => {
  let payments: PaymentsService;
  let prisma: PrismaService;
  let events: { emit: jest.Mock };
  let countryId: string;
  let quartierId: string;
  let managerAId: string;
  let managerBId: string;
  let strangerId: string;
  let tenantUserId: string;
  let orgId: string;
  let propertyId: string;
  let leaseId: string;
  let scheduleId: string;
  let dualPaymentId: string;

  const phones = {
    managerA: '+242070000191',
    managerB: '+242070000192',
    stranger: '+242070000193',
    tenant: '+242070000194',
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
            uploadPrivateFile: jest.fn(async (params: { key?: string }) => ({
              url: `https://fake.r2/${params.key ?? 'x'}`,
              key: params.key ?? 'reconciliation/x',
            })),
            createPresignedDownload: jest.fn(async (key: string) => key),
          },
        },
      ],
    }).compile();

    payments = moduleRef.get(PaymentsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    quartierId = quartier.id;

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
      await prisma.receipt.deleteMany({
        where: { payment: { userId: { in: staleIds } } },
      });
      await prisma.payment.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const mk = (phone: string, name: string, role = 'TENANT') =>
      prisma.user.create({
        data: { phone, countryId, name, roles: { create: { role } } },
      });
    managerAId = (await mk(phones.managerA, 'Spec053 ManagerA')).id;
    managerBId = (await mk(phones.managerB, 'Spec053 ManagerB')).id;
    strangerId = (await mk(phones.stranger, 'Spec053 Stranger')).id;
    tenantUserId = (await mk(phones.tenant, 'Spec053 Tenant')).id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec053 Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        requireDualCashValidation: true,
        members: {
          create: [
            { userId: managerAId, role: 'OWNER' },
            { userId: managerBId, role: 'ADMIN' },
          ],
        },
      },
    });
    orgId = org.id;

    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec053 Property',
          description: 'Double validation espèces',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 150000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId,
          address: 'Spec053',
          countryId,
          ownerId: managerAId,
          organizationId: orgId,
        },
      })
    ).id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2027-01-01T00:00:00Z'),
        currency: 'XAF',
        status: 'ACTIVE',
        monthlyRent: 150000,
        deposit: 300000,
      },
    });
    leaseId = lease.id;

    scheduleId = (
      await prisma.rentSchedule.create({
        data: {
          leaseId,
          dueDate: new Date('2026-11-01T00:00:00Z'),
          amount: 150000,
          currency: 'XAF',
          status: 'PENDING',
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (dualPaymentId) {
      await prisma.paymentAllocation
        .deleteMany({ where: { paymentId: dualPaymentId } })
        .catch(() => undefined);
      await prisma.receipt
        .deleteMany({ where: { paymentId: dualPaymentId } })
        .catch(() => undefined);
      await prisma.payment
        .delete({ where: { id: dualPaymentId } })
        .catch(() => undefined);
    }
    if (leaseId) {
      await prisma.paymentAllocation
        .deleteMany({ where: { rentSchedule: { leaseId } } })
        .catch(() => undefined);
      await prisma.rentReceipt
        .deleteMany({ where: { rentSchedule: { leaseId } } })
        .catch(() => undefined);
      await prisma.rentSchedule
        .deleteMany({ where: { leaseId } })
        .catch(() => undefined);
      await prisma.lease.delete({ where: { id: leaseId } }).catch(() => undefined);
    }
    const ids = [managerAId, managerBId, strangerId, tenantUserId].filter(Boolean);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { userId: { in: ids } } });
    await prisma.organization.delete({ where: { id: orgId } }).catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.onModuleDestroy();
  });

  it('enregistre en espèces : PENDING_VALIDATION quand la double validation est exigée', async () => {
    const payment = await payments.recordCashPayment(managerAId, {
      rentScheduleId: scheduleId,
      idempotencyKey: `spec053-dual-${Date.now()}`,
    });
    dualPaymentId = payment.id;
    expect(payment.status).toBe('PENDING_VALIDATION');

    // Apparaît dans la file d'attente des gestionnaires du portefeuille.
    const pending = await payments.listPendingValidation(managerAId);
    expect(pending.some((p) => p.id === payment.id)).toBe(true);
    expect(events.emit).not.toHaveBeenCalledWith('payment.validated');
  });

  it('refuse la validation par le gestionnaire qui a enregistré', async () => {
    await expect(
      payments.validateCashPayment(managerAId, dualPaymentId, [
        {
          type: 'RENT_SCHEDULE',
          refId: scheduleId,
          amount: 150000,
          rentScheduleId: scheduleId,
        },
      ]),
    ).rejects.toMatchObject({
      response: { code: 'DUAL_VALIDATION_REQUIRED' },
    });
  });

  it('un second gestionnaire valide (allocutions + quittance)', async () => {
    const validated = await payments.validateCashPayment(
      managerBId,
      dualPaymentId,
      [
        {
          type: 'RENT_SCHEDULE',
          refId: scheduleId,
          amount: 150000,
          rentScheduleId: scheduleId,
        },
      ],
    );
    expect(validated.status).toBe('VALIDATED');
    expect(validated.validatedBy).toBe(managerBId);
    expect(validated.allocations?.length).toBe(1);

    const schedule = await prisma.rentSchedule.findUnique({
      where: { id: scheduleId },
    });
    expect(schedule?.status).toBe('PAID');
  });

  it('exporte le portefeuille géré en CSV', async () => {
    const csv = await payments.exportManagedCsv(managerAId);
    const [header, ...rows] = csv.split('\n');
    expect(header).toContain('providerRef');
    expect(header).toContain('reference');
    expect(rows.length).toBeGreaterThanOrEqual(1);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: dualPaymentId },
    });
    expect(csv).toContain(payment.reference);

    // Un étranger n'a aucun bien géré : en-tête seul.
    const strangerCsv = await payments.exportManagedCsv(strangerId);
    expect(strangerCsv).toBe(header);
    expect(strangerCsv).not.toContain('\n');
  });
});
