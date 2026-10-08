import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DepositsModule } from './deposits.module';
import { DepositsService } from './deposits.service';
import { LeasesModule } from '../leases/leases.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Spec 04 P1 — caution (deposit).
 *
 * Covers the deposit called as a `DEPOSIT` schedule line, deductions proposed
 * on the exit inspection and contested by the tenant within 15 days, and the
 * settlement: refund = deposit − accepted deductions, with a `DEPOSIT_OUT`
 * ledger entry and a payout to validate.
 */
describe('Deposits HTTP — caution (spec 04 P1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let deposits: DepositsService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let outsiderUserId: string;
  let propertyId: string;
  const phones = {
    owner: '+242070000051',
    tenant: '+242070000052',
    outsider: '+242070000053',
  };
  const createdLeaseIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, LeasesModule, DepositsModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(
      new (require('../common/filters/http-exception.filter').HttpExceptionFilter)(),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    deposits = moduleRef.get(DepositsService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    const stale = await prisma.user.findMany({
      where: { phone: { in: Object.values(phones) } },
      select: { id: true },
    });
    if (stale.length) {
      await prisma.notification.deleteMany({
        where: { userId: { in: stale.map((u) => u.id) } },
      });
    }
    await prisma.user.deleteMany({ where: { phone: { in: Object.values(phones) } } });
    const mk = async (phone: string, name: string) =>
      prisma.user.create({
        data: { phone, countryId, name, roles: { create: { role: 'TENANT' } } },
      });
    ownerUserId = (await mk(phones.owner, 'Spec04 Deposit Owner')).id;
    tenantUserId = (await mk(phones.tenant, 'Spec04 Deposit Tenant')).id;
    outsiderUserId = (await mk(phones.outsider, 'Spec04 Deposit Outsider')).id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec04 Deposit Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec04 Deposit Property',
          description: 'Caution',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 100000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'Spec04 Deposit',
          countryId,
          ownerId: ownerUserId,
          organizationId: org.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (createdLeaseIds.length) {
      await prisma.depositSettlement
        .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
        .catch(() => undefined);
      await prisma.paymentAllocation
        .deleteMany({ where: { rentSchedule: { leaseId: { in: createdLeaseIds } } } })
        .catch(() => undefined);
      await prisma.payment
        .deleteMany({
          where: { reference: { startsWith: 'deposit-refund-' } },
        })
        .catch(() => undefined);
      await prisma.notification.deleteMany({
        where: { userId: { in: [ownerUserId, tenantUserId] } },
      });
      await prisma.ledgerEntry
        .deleteMany({ where: { propertyId } })
        .catch(() => undefined);
      await prisma.rentSchedule
        .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
        .catch(() => undefined);
      await prisma.lease
        .deleteMany({ where: { id: { in: createdLeaseIds } } })
        .catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, outsiderUserId] } },
    });
    await prisma.organization
      .deleteMany({ where: { members: { some: { userId: ownerUserId } } } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, outsiderUserId] } },
    });
    await prisma.user
      .deleteMany({
        where: { id: { in: [ownerUserId, tenantUserId, outsiderUserId] } },
      })
      .catch(() => undefined);
    await app.close();
    await prisma.onModuleDestroy();
  });

  /**
   * ACTIVE lease with the tenant linked to the account. Each call uses its own
   * year so two leases never overlap on the property (409 LEASE_OVERLAP).
   */
  let leaseYear = 2035;
  async function activeLease(monthlyRent = 100000, deposit = 200000): Promise<string> {
    leaseYear += 1;
    const year = leaseYear;
    const created = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send({
        propertyId,
        invitedPhone: phones.tenant,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
        monthlyRent,
        deposit,
        currency: 'XAF',
      })
      .expect(201);
    createdLeaseIds.push(created.body.id);
    await request(app.getHttpServer())
      .patch(`/api/v1/leases/${created.body.id}/activate`)
      .set('x-test-user', ownerUserId)
      .expect(200);
    return created.body.id;
  }

  async function giveNotice(leaseId: string): Promise<void> {
    await prisma.lease.update({
      where: { id: leaseId },
      data: {
        status: 'TERMINATING',
        terminationInitiator: 'TENANT',
        terminationNoticeAt: new Date(),
        terminationEffectiveAt: new Date(),
      },
    });
  }

  it('activation calls the deposit as its own schedule line', async () => {
    const leaseId = await activeLease();
    const schedules = await prisma.rentSchedule.findMany({
      where: { leaseId },
      orderBy: { dueDate: 'asc' },
    });
    const depositLine = schedules.find((s) => s.kind === 'DEPOSIT');
    expect(depositLine?.amount.toString()).toBe('200000');
    expect(depositLine?.dueDate.toISOString()).toContain(
      `${depositLine?.dueDate.getUTCFullYear()}-01-01`,
    );
    expect(depositLine?.status).toBe('PENDING');
    expect(schedules.filter((s) => s.kind === 'RENT')).toHaveLength(12);
  });

  it('the deposit cannot exceed three months of rent', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send({
        propertyId,
        invitedPhone: phones.tenant,
        startDate: '2037-01-01',
        endDate: '2037-12-31',
        monthlyRent: 100000,
        deposit: 400000,
        currency: 'XAF',
      })
      .expect(400);
    expect(res.body.code).toBe('DEPOSIT_EXCEEDS_CAP');
  });

  it('a running lease has no deduction and no refund deadline', async () => {
    const leaseId = await activeLease();
    const res = await request(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}/deposit`)
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(res.body.depositAmount).toBe('200000');
    expect(res.body.schedule.amount).toBe('200000');
    expect(res.body.heldAmount).toBe('0');
    expect(res.body.deductions).toEqual([]);
    expect(res.body.refundDeadline).toBeNull();

    const blocked = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/deposit/deductions`)
      .set('x-test-user', ownerUserId)
      .send({ label: 'Rayures', amount: 5000 })
      .expect(409);
    expect(blocked.body.code).toBe('LEASE_NOT_CLOSING');

    await request(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}/deposit`)
      .set('x-test-user', outsiderUserId)
      .expect(403);
  });

  it('the tenant contests within 15 days, the manager accepts, the refund is the rest', async () => {
    const leaseId = await activeLease();
    await giveNotice(leaseId);

    const first = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/deposit/deductions`)
      .set('x-test-user', ownerUserId)
      .send({ label: 'Rayures porte', amount: 15000, evidenceKeys: ['edl/porte.jpg'] })
      .expect(201);
    expect(first.body.status).toBe('PROPOSED');
    expect(first.body.contestable).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/deposit/deductions`)
      .set('x-test-user', ownerUserId)
      .send({ label: 'Carrelage', amount: 50000 })
      .expect(201);

    // Deductions can never exceed the deposit held.
    const tooMuch = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/deposit/deductions`)
      .set('x-test-user', ownerUserId)
      .send({ label: 'Dégâts', amount: 150000 })
      .expect(400);
    expect(tooMuch.body.code).toBe('DEPOSIT_DEDUCTIONS_EXCEED_DEPOSIT');

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/deposit/deductions`)
      .set('x-test-user', outsiderUserId)
      .send({ label: 'Pirate', amount: 1000 })
      .expect(403);

    // The tenant cannot accept, only contest, and must explain why.
    await request(app.getHttpServer())
      .patch(`/api/v1/deposit-deductions/${first.body.id}`)
      .set('x-test-user', tenantUserId)
      .send({ status: 'ACCEPTED' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/v1/deposit-deductions/${first.body.id}`)
      .set('x-test-user', tenantUserId)
      .send({ status: 'CONTESTED' })
      .expect(400);

    const contested = await request(app.getHttpServer())
      .patch(`/api/v1/deposit-deductions/${first.body.id}`)
      .set('x-test-user', tenantUserId)
      .send({ status: 'CONTESTED', tenantComment: 'Rayures antérieures à mon arrivée' })
      .expect(200);
    expect(contested.body.status).toBe('CONTESTED');
    expect(contested.body.tenantComment).toContain('antérieures');

    // A contested deduction cannot be contested twice.
    await request(app.getHttpServer())
      .patch(`/api/v1/deposit-deductions/${first.body.id}`)
      .set('x-test-user', tenantUserId)
      .send({ status: 'CONTESTED', tenantComment: 'Encore une fois' })
      .expect(409);

    // Only the manager accepts.
    const accepted = await request(app.getHttpServer())
      .patch(`/api/v1/deposit-deductions/${first.body.id}`)
      .set('x-test-user', ownerUserId)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    expect(accepted.body.status).toBe('ACCEPTED');

    const summary = await request(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}/deposit`)
      .set('x-test-user', tenantUserId)
      .expect(200);
    expect(summary.body.deductedTotal).toBe('15000');
    expect(summary.body.openTotal).toBe('50000');
    expect(summary.body.refundDeadline).not.toBeNull();

    const settled = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/deposit/settle`)
      .set('x-test-user', ownerUserId)
      .send({ method: 'CASH', note: 'Restitution en espèces' })
      .expect(201);
    expect(settled.body.settlement).toMatchObject({
      heldAmount: '200000',
      deducted: '15000',
      refundAmount: '185000',
    });
    expect(settled.body.settlement.settledAt).not.toBeNull();

    const payout = await prisma.payment.findUniqueOrThrow({
      where: { id: settled.body.settlement.payoutId },
    });
    expect(payout.amount.toString()).toBe('185000');
    expect(payout.status).toBe('PENDING_VALIDATION');

    const ledger = await prisma.ledgerEntry.findFirst({
      where: { sourceType: 'DEPOSIT_SETTLEMENT', sourceId: settled.body.settlement.id },
    });
    expect(ledger?.type).toBe('DEPOSIT_OUT');
    expect(ledger?.amount.toString()).toBe('-185000');

    const twice = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/deposit/settle`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(409);
    expect(twice.body.code).toBe('DEPOSIT_ALREADY_SETTLED');
  });

  it('a deduction past its 15 days can no longer be contested', async () => {
    const leaseId = await activeLease();
    await giveNotice(leaseId);
    const created = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/deposit/deductions`)
      .set('x-test-user', ownerUserId)
      .send({ label: 'Perte de clé', amount: 25000 })
      .expect(201);

    await prisma.depositDeduction.update({
      where: { id: created.body.id },
      data: { createdAt: new Date(Date.now() - 16 * 86_400_000) },
    });

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/deposit-deductions/${created.body.id}`)
      .set('x-test-user', tenantUserId)
      .send({ status: 'CONTESTED', tenantComment: 'Trop tard ?' })
      .expect(409);
    expect(res.body.code).toBe('DEPOSIT_CONTEST_WINDOW_CLOSED');
  });

  it('a settled deposit with no accepted deduction refunds everything', async () => {
    const leaseId = await activeLease(120000, 120000);
    await giveNotice(leaseId);
    const settled = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/deposit/settle`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(201);
    expect(settled.body.settlement.refundAmount).toBe('120000');
    expect(settled.body.settlement.deducted).toBe('0');
  });

  it('the owner is warned at J+25, once per day, on a lease closing without a refund', async () => {
    const leaseId = await activeLease();
    const twentySixDaysAgo = new Date(Date.now() - 26 * 86_400_000);
    await prisma.lease.update({
      where: { id: leaseId },
      data: { status: 'TERMINATED', terminatedAt: twentySixDaysAgo },
    });
    await prisma.notification.deleteMany({
      where: { userId: ownerUserId, type: 'DEPOSIT_REFUND_DUE' },
    });

    expect(await deposits.alertRefundsDue()).toBeGreaterThan(0);
    const alerts = await prisma.notification.findMany({
      where: { userId: ownerUserId, type: 'DEPOSIT_REFUND_DUE' },
    });
    expect(alerts.some((n) => (n.payload as { leaseId?: string }).leaseId === leaseId)).toBe(true);

    // Idempotent within the day.
    await deposits.alertRefundsDue();
    const again = await prisma.notification.count({
      where: { userId: ownerUserId, type: 'DEPOSIT_REFUND_DUE' },
    });
    expect(again).toBe(alerts.length);
  });
});
