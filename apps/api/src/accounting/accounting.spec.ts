import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import { RentScheduleGenerator } from '../leases/rent-schedule.generator.service';
import { R2Service } from '../media/r2.service';
import { NotificationsService } from '../notifications/notifications.service';
import { LedgerProcessor } from './ledger.processor';
import { ExpensesService } from './expenses.service';
import { AccountingService } from './accounting.service';

describe('Spec 03 — comptabilité : grand livre, dépenses, relevés', () => {
  let ledger: LedgerProcessor;
  let expenses: ExpensesService;
  let accounting: AccountingService;
  let approvals: MandateApprovalService;
  let prisma: PrismaService;
  const emittedEvents: Array<{ name: string; payload: unknown }> = [];

  let countryId: string;
  let quartierId: string;
  let ownerUserId: string;
  let gerantUserId: string;
  let tenantUserId: string;
  let ownerOrgId: string;
  let agencyOrgId: string;
  let propertyId: string;
  let mandateId: string;
  let leaseId: string;
  let scheduleId: string;
  const createdApprovalIds: string[] = [];
  const createdExpenseIds: string[] = [];
  const createdPaymentIds: string[] = [];

  beforeAll(async () => {
    const eventBus: Pick<EventPublisher, 'emit'> = {
      // eslint-disable-next-line @typescript-eslint/require-await
      emit: jest.fn(async (name, payload) => {
        emittedEvents.push({ name, payload });
        return { id: 'mock', name };
      }),
    };
    const fakeR2 = {
      uploadLeaseFile: jest.fn(async () => ({
        url: 'https://fake.r2/avenant.pdf',
        key: 'avenant.pdf',
      })),
      uploadPrivateFile: jest.fn(
        async (p: { filename: string }) => ({
          url: `https://fake.r2/${p.filename}`,
          key: `private/${p.filename}`,
        }),
      ),
      createPresignedDownload: jest.fn(
        async (key: string) => `https://fake.r2/dl/${key}?sig=x`,
      ),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LedgerProcessor,
        ExpensesService,
        AccountingService,
        MandateApprovalService,
        AgencyAccessService,
        RentScheduleGenerator,
        PrismaService,
        { provide: EventPublisher, useValue: eventBus },
        { provide: R2Service, useValue: fakeR2 },
        {
          provide: NotificationsService,
          useValue: { send: jest.fn(async () => ({ status: 'SENT' })) },
        },
      ],
    }).compile();
    ledger = moduleRef.get(LedgerProcessor);
    expenses = moduleRef.get(ExpensesService);
    accounting = moduleRef.get(AccountingService);
    approvals = moduleRef.get(MandateApprovalService);
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
      where: { phone: { in: ['+242072500001', '+242072500002', '+242072500003'] } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      const staleProps = await prisma.property.findMany({
        where: { ownerId: { in: staleIds } },
        select: { id: true },
      });
      const stalePropIds = staleProps.map((p) => p.id);
      if (stalePropIds.length) {
        await prisma.ledgerEntry.deleteMany({
          where: { propertyId: { in: stalePropIds } },
        });
        await prisma.expense.deleteMany({
          where: { propertyId: { in: stalePropIds } },
        });
        const staleLeases = await prisma.lease.findMany({
          where: { propertyId: { in: stalePropIds } },
          select: { id: true },
        });
        const staleLeaseIds = staleLeases.map((l) => l.id);
        if (staleLeaseIds.length) {
          await prisma.paymentAllocation.deleteMany({
            where: { rentSchedule: { leaseId: { in: staleLeaseIds } } },
          });
          await prisma.rentSchedule.deleteMany({
            where: { leaseId: { in: staleLeaseIds } },
          });
          await prisma.lease.deleteMany({ where: { id: { in: staleLeaseIds } } });
        }
        await prisma.property.deleteMany({
          where: { id: { in: stalePropIds } },
        });
      }
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }
    await prisma.organization.deleteMany({
      where: {
        name: { startsWith: 'Accounting Spec' },
        members: { none: {} },
        properties: { none: {} },
      },
    });

    const owner = await prisma.user.create({
      data: { phone: '+242072500001', countryId, name: 'Acct Owner' },
    });
    ownerUserId = owner.id;
    const gerant = await prisma.user.create({
      data: { phone: '+242072500002', countryId, name: 'Acct Gérant' },
    });
    gerantUserId = gerant.id;
    const tenant = await prisma.user.create({
      data: { phone: '+242072500003', countryId, name: 'Acct Tenant' },
    });
    tenantUserId = tenant.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Accounting Spec Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;
    const agencyOrg = await prisma.organization.create({
      data: {
        name: `Accounting Spec Agency ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: gerantUserId, role: 'ADMIN' } },
      },
    });
    agencyOrgId = agencyOrg.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Accounting Spec Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'x',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrgId,
      },
    });
    propertyId = prop.id;

    const mandate = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: agencyOrgId,
        status: 'ACTIVE',
        proposedById: ownerUserId,
        managementFeeRate: 0.08,
        repairApprovalThreshold: 100000,
      },
    });
    mandateId = mandate.id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        monthlyRent: 100000,
        deposit: 100000,
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    leaseId = lease.id;
    const schedule = await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date('2026-10-01'),
        amount: 100000,
        currency: 'XAF',
        status: 'PENDING',
      },
    });
    scheduleId = schedule.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (createdApprovalIds.length) {
      await prisma.mandateApproval
        .deleteMany({ where: { id: { in: createdApprovalIds } } })
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
    if (propertyId) {
      await prisma.ledgerEntry
        .deleteMany({ where: { propertyId } })
        .catch(() => undefined);
      await prisma.expense
        .deleteMany({ where: { propertyId } })
        .catch(() => undefined);
      await prisma.rentSchedule
        .deleteMany({ where: { leaseId } })
        .catch(() => undefined);
      await prisma.lease.deleteMany({ where: { id: leaseId } }).catch(() => undefined);
      await prisma.mandate
        .deleteMany({ where: { id: mandateId } })
        .catch(() => undefined);
      await prisma.property.deleteMany({ where: { id: propertyId } }).catch(() => undefined);
    }
    const userIds = [ownerUserId, gerantUserId, tenantUserId].filter(Boolean);
    if (userIds.length) {
      await prisma.organizationMember
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.userRole
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.user
        .deleteMany({ where: { id: { in: userIds } } })
        .catch(() => undefined);
    }
    const orgIds = [ownerOrgId, agencyOrgId].filter(Boolean);
    if (orgIds.length) {
      await prisma.organization
        .deleteMany({ where: { id: { in: orgIds } } })
        .catch(() => undefined);
    }
    await prisma.onModuleDestroy();
  });

  beforeEach(() => {
    emittedEvents.length = 0;
  });

  // ---------------------------------------------------------------- Ledger
  it('a validated rent payment under an 8 % mandate writes RENT_IN +100 % and FEE −8 %', async () => {
    const payment = await prisma.payment.create({
      data: {
        userId: tenantUserId,
        amount: 100000,
        currency: 'XAF',
        method: 'CASH',
        status: 'VALIDATED',
        reference: `acct-${Date.now()}`,
        idempotencyKey: `acct-${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);
    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        type: 'RENT_SCHEDULE',
        refId: scheduleId,
        rentScheduleId: scheduleId,
        amount: 100000,
      },
    });

    const result = await ledger.recordPayment(payment.id);
    expect(result.entries).toBe(2);

    // Idempotent on re-run.
    expect((await ledger.recordPayment(payment.id)).entries).toBe(0);

    const rows = await prisma.ledgerEntry.findMany({
      where: { sourceType: 'PAYMENT', sourceId: payment.id },
    });
    const rentIn = rows.find((r) => r.type === 'RENT_IN');
    const fee = rows.find((r) => r.type === 'FEE');
    expect(rentIn?.amount.toString()).toBe('100000');
    expect(fee?.amount.toString()).toBe('-8000');
    expect(rentIn?.agencyOrgId).toBe(agencyOrgId);
    expect(rentIn?.ownerOrgId).toBe(ownerOrgId);
    expect(rentIn?.mandateId).toBe(mandateId);
  });

  it('a validated deposit payment writes DEPOSIT_IN and no management fee', async () => {
    const depositSchedule = await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date('2026-01-01'),
        kind: 'DEPOSIT',
        amount: 100000,
        currency: 'XAF',
        status: 'PENDING',
      },
    });
    const payment = await prisma.payment.create({
      data: {
        userId: tenantUserId,
        amount: 100000,
        currency: 'XAF',
        method: 'CASH',
        status: 'VALIDATED',
        reference: `acct-deposit-${Date.now()}`,
        idempotencyKey: `acct-deposit-${Date.now()}`,
      },
    });
    createdPaymentIds.push(payment.id);
    await prisma.paymentAllocation.create({
      data: {
        paymentId: payment.id,
        type: 'RENT_SCHEDULE',
        refId: depositSchedule.id,
        rentScheduleId: depositSchedule.id,
        amount: 100000,
      },
    });

    // One entry only: the deposit is not subject to the management fee.
    expect((await ledger.recordPayment(payment.id)).entries).toBe(1);

    const rows = await prisma.ledgerEntry.findMany({
      where: { sourceType: 'PAYMENT', sourceId: payment.id },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('DEPOSIT_IN');
    expect(rows[0].amount.toString()).toBe('100000');
    expect(rows[0].label).toContain('Caution');
  });

  // -------------------------------------------------------------- Expenses
  it('an expense below the mandate threshold is approved immediately', async () => {
    const expense = await expenses.createExpense(gerantUserId, {
      propertyId,
      category: 'REPAIR',
      label: 'Petite fuite',
      amount: 50000,
    });
    createdExpenseIds.push(expense.id);
    expect(expense.status).toBe('APPROVED');
    expect(
      emittedEvents.find((e) => e.name === 'expense.approved'),
    ).toBeDefined();

    const recorded = await ledger.recordExpense(expense.id);
    expect(recorded.entries).toBe(1);
    const entry = await prisma.ledgerEntry.findFirst({
      where: { sourceType: 'EXPENSE', sourceId: expense.id },
    });
    expect(entry?.amount.toString()).toBe('-50000');
    expect(entry?.type).toBe('EXPENSE');
    // Idempotent.
    expect((await ledger.recordExpense(expense.id)).entries).toBe(0);
  });

  it('an expense above the threshold waits for an EXPENSE approval', async () => {
    const expense = await expenses.createExpense(gerantUserId, {
      propertyId,
      category: 'REPAIR',
      label: 'Remplacement charpente',
      amount: 250000,
    });
    createdExpenseIds.push(expense.id);
    expect(expense.status).toBe('PENDING_APPROVAL');
    expect(expense.mandateId).toBe(mandateId);

    const pending = await approvals.listForMandate(mandateId);
    const approval = pending.find(
      (a) => a.actionType === 'EXPENSE' && a.status === 'PENDING',
    );
    expect(approval).toBeDefined();
    if (!approval) throw new Error('approval missing');
    createdApprovalIds.push(approval.id);

    // Not in the ledger until approved.
    expect(
      await prisma.ledgerEntry.count({
        where: { sourceType: 'EXPENSE', sourceId: expense.id },
      }),
    ).toBe(0);

    const decided = await approvals.decideApproval(ownerUserId, approval.id, {
      decision: 'APPROVE',
    });
    expect(decided.status).toBe('APPROVED');

    const updated = await prisma.expense.findUniqueOrThrow({
      where: { id: expense.id },
    });
    expect(updated.status).toBe('APPROVED');
    expect(
      emittedEvents.find((e) => e.name === 'expense.approved'),
    ).toBeDefined();

    expect((await ledger.recordExpense(expense.id)).entries).toBe(1);
  });

  it('only the creator can modify a DRAFT expense', async () => {
    const expense = await expenses.createExpense(gerantUserId, {
      propertyId,
      category: 'TAX',
      label: 'Taxe foncière',
      amount: 10000,
      draft: true,
    });
    createdExpenseIds.push(expense.id);
    expect(expense.status).toBe('DRAFT');

    await expect(
      expenses.updateExpense(ownerUserId, expense.id, { label: 'Hack' }),
    ).rejects.toMatchObject({ response: { code: 'NOT_EXPENSE_CREATOR' } });

    const updated = await expenses.updateExpense(gerantUserId, expense.id, {
      label: 'Taxe foncière 2026',
      submit: true,
    });
    expect(updated.label).toBe('Taxe foncière 2026');
    expect(updated.status).toBe('APPROVED');
  });

  // ------------------------------------------------- Summary / relevé / fees
  it('owner summary sums the ledger and the statement net matches it', async () => {
    const summary = await accounting.ownerSummary(ownerUserId, {});
    expect(Number(summary.totals.RENT_IN)).toBeGreaterThan(0);
    expect(Number(summary.totals.FEE)).toBeLessThan(0);
    expect(Number(summary.totals.EXPENSE)).toBeLessThan(0);

    const page = await accounting.ownerLedger(ownerUserId, {
      page: 1,
      pageSize: 10,
    });
    expect(page.meta.total).toBe(summary.count);
    const sumFromRows = page.data.reduce(
      (acc, row) => acc + Number(row.amount),
      0,
    );
    expect(sumFromRows).toBeCloseTo(Number(summary.net), 2);

    const statement = await accounting.generateStatement(ownerUserId, {
      mandateId,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2027-01-01'),
    });
    const totals = statement.totals as Record<string, string>;
    const entriesSum = page.data
      .filter(() => true)
      .reduce((acc, row) => acc + Number(row.amount), 0);
    // Net = sum of all ledger rows of the period (acceptance criterion).
    const allRows = await accounting.ownerLedger(ownerUserId, {
      pageSize: 100,
    });
    const allSum = allRows.data.reduce(
      (acc, row) => acc + Number(row.amount),
      0,
    );
    expect(Number(totals.net)).toBeCloseTo(allSum, 2);
    expect(String(statement.url)).toContain('fake.r2');
    expect(entriesSum).not.toBeNaN();
  });

  it('agency fees are grouped per mandate', async () => {
    const fees = await accounting.agencyFees(gerantUserId, {});
    const ours = fees.data.find((f) => f.mandateId === mandateId);
    expect(ours).toBeDefined();
    expect(Number(ours?.totalFee)).toBeGreaterThan(0);
    expect(ours?.propertyId).toBe(propertyId);
  });

  it('CSV export starts with the header row', async () => {
    const csv = await accounting.exportCsv(ownerUserId, {});
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'id,date,type,label,amount,currency,propertyId,mandateId,sourceType,sourceId',
    );
    expect(lines.length).toBeGreaterThan(1);
  });
});
