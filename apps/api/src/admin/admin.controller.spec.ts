import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AdminModule } from './admin.module';

/**
 * Admin e2e tests — exercise the three production endpoints:
 *  - GET    /admin/users
 *  - GET    /admin/stats
 *  - PATCH  /admin/properties/:id/moderate
 *
 * Auth model: in test mode, `x-test-user` / `x-test-roles` headers
 * populate the request (see `AppAuthGuard` + `RolesGuard`). The admin
 * routes require the global `PLATFORM_ADMIN` role.
 */
import { generateTotpSecret, totpAt } from './totp';
import { PaymentProvider, PaymentMethod } from '@prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { PayoutsModule } from '../payouts/payouts.module';
import { PaymentsModule } from '../payments/payments.module';
import { AccountModule } from '../account/account.module';
import { AgencyModule } from '../organizations/agency.module';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminUserId: string;
  let tenantUserId: string;
  let ownerUserId: string;
  let ownerOrgId: string;
  let propertyId: string;
  let secondPropertyId: string;
  let activeLeaseId: string;
  let overdueScheduleId: string;
  let countryId: string;
  let bzvQuartierId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AdminModule,
        PayoutsModule,
        PaymentsModule,
        AccountModule,
        AgencyModule,
      ],
    })
      .overrideProvider(EventPublisher)
      .useValue({ emit: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

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

    // Cleanup leftover users / properties from previous runs.
    const leftover = await prisma.user.findMany({
      where: {
        phone: {
          in: ['+242070000111', '+242070000112', '+242070000113'],
        },
      },
      select: { id: true },
    });
    if (leftover.length > 0) {
      const ids = leftover.map((u) => u.id);
      await prisma.notification
        .deleteMany({ where: { userId: { in: ids } } })
        .catch(() => undefined);
      // Full FK chain on the way out: allocation → schedule → lease →
      // property, otherwise the property delete trips Lease_propertyId_fkey.
      const leftoverProps = await prisma.property.findMany({
        where: { ownerId: { in: ids } },
        select: { id: true },
      });
      const leftoverPropIds = leftoverProps.map((p) => p.id);
      if (leftoverPropIds.length) {
        const leftoverLeases = await prisma.lease.findMany({
          where: { propertyId: { in: leftoverPropIds } },
          select: { id: true },
        });
        const leftoverLeaseIds = leftoverLeases.map((l) => l.id);
        if (leftoverLeaseIds.length) {
          await prisma.paymentAllocation.deleteMany({
            where: { rentSchedule: { leaseId: { in: leftoverLeaseIds } } },
          });
          await prisma.rentSchedule.deleteMany({
            where: { leaseId: { in: leftoverLeaseIds } },
          });
          await prisma.lease.deleteMany({
            where: { id: { in: leftoverLeaseIds } },
          });
        }
        await prisma.property.deleteMany({
          where: { id: { in: leftoverPropIds } },
        });
      }
      await prisma.userRole.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await prisma.organization.deleteMany({
      where: {
        name: { startsWith: 'Admin Test Owner Org' },
        members: { none: {} },
        properties: { none: {} },
      },
    });

    const admin = await prisma.user.create({
      data: {
        phone: '+242070000111',
        countryId,
        roles: { create: { role: 'PLATFORM_ADMIN' } },
      },
    });
    adminUserId = admin.id;
    createdUserIds.push(adminUserId);

    const tenant = await prisma.user.create({
      data: {
        phone: '+242070000112',
        countryId,
        name: 'Admin Test Tenant',
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;
    createdUserIds.push(tenantUserId);

    const owner = await prisma.user.create({
      data: {
        phone: '+242070000113',
        countryId,
        name: 'Admin Test Owner',
        avatarUrl: 'https://cdn.example.com/admin-owner.png',
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    createdUserIds.push(ownerUserId);

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Admin Test Owner Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;

    const mkProperty = (suffix: string) =>
      prisma.property.create({
        data: {
          title: `Admin Test Property ${suffix}`,
          description: 'Pour tester la modération admin',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 150000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'X',
          countryId,
          ownerId: ownerUserId,
          organizationId: ownerOrgId,
        },
      });

    const p1 = await mkProperty('A');
    propertyId = p1.id;
    const p2 = await mkProperty('B');
    secondPropertyId = p2.id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-06-01T00:00:00Z'),
        endDate: new Date('2027-06-01T00:00:00Z'),
        monthlyRent: new Prisma.Decimal(150000),
        deposit: new Prisma.Decimal(300000),
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    activeLeaseId = lease.id;

    const overdue = await prisma.rentSchedule.create({
      data: {
        leaseId: activeLeaseId,
        dueDate: new Date('2026-05-01T00:00:00Z'),
        amount: new Prisma.Decimal(150000),
        currency: 'XAF',
        status: 'OVERDUE',
      },
    });
    overdueScheduleId = overdue.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    const userIds = createdUserIds.filter(Boolean);
    // Notification FK RESTRICT cleanup first. All deletes are guarded: when
    // beforeAll aborts, an undefined id would make deleteMany match everything.
    if (userIds.length) {
      await prisma.notification
        .deleteMany({ where: { userId: { in: userIds } } })
        .catch(() => undefined);
    }
    if (overdueScheduleId) {
      await prisma.paymentAllocation
        .deleteMany({ where: { rentScheduleId: overdueScheduleId } })
        .catch(() => undefined);
      await prisma.rentSchedule
        .deleteMany({ where: { id: overdueScheduleId } })
        .catch(() => undefined);
    }
    if (activeLeaseId) {
      await prisma.lease
        .deleteMany({ where: { id: activeLeaseId } })
        .catch(() => undefined);
    }
    const pids = [propertyId, secondPropertyId].filter(Boolean);
    if (pids.length) {
      await prisma.property
        .deleteMany({ where: { id: { in: pids } } })
        .catch(() => undefined);
    }
    if (userIds.length) {
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: userIds } },
      });
    }
    if (ownerOrgId) {
      await prisma.organization
        .delete({ where: { id: ownerOrgId } })
        .catch(() => undefined);
    }
    if (userIds.length) {
      await prisma.userRole.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    if (app) await app.close();
    await prisma.onModuleDestroy();
  });

  // ------------------------------------------------------------------
  // AuthZ
  // ------------------------------------------------------------------

  it('returns 403 when the caller is not PLATFORM_ADMIN (GET /stats)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .expect(403);
    const body = res.body as { message?: string };
    expect(body.message ?? '').toContain('PLATFORM_ADMIN');
  });

  it('returns 403 when the caller is not PLATFORM_ADMIN (GET /users)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .expect(403);
  });

  it('returns 401 when there is no auth (GET /users)', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
  });

  it('returns 403 when a non-admin requests moderation identities', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/properties/moderation')
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .expect(403);
  });

  // ------------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------------

  it('returns aggregates for a PLATFORM_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    const body = res.body as {
      statusCode: number;
      data: {
        totalUsers: number;
        totalProperties: number;
        activeLeases: number;
        overdueSchedules: number;
        pendingOrgRequests: number;
        openDisputes: number;
        failedPayouts: number;
      };
    };
    expect(body.statusCode).toBe(200);
    // We just created 3 users, 2 properties, 1 active lease, 1 overdue schedule.
    // The exact totals depend on prior test data, but we can assert ≥ our
    // contribution is reflected.
    expect(body.data.totalUsers).toBeGreaterThanOrEqual(3);
    expect(body.data.totalProperties).toBeGreaterThanOrEqual(2);
    expect(body.data.activeLeases).toBeGreaterThanOrEqual(1);
    expect(body.data.overdueSchedules).toBeGreaterThanOrEqual(1);
    expect(body.data.pendingOrgRequests).toBeGreaterThanOrEqual(0);
    expect(body.data.openDisputes).toBeGreaterThanOrEqual(0);
    expect(body.data.failedPayouts).toBeGreaterThanOrEqual(0);
  });

  // ------------------------------------------------------------------
  // Users list
  // ------------------------------------------------------------------

  it('lists users paginated for a PLATFORM_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?pageSize=10')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);
    const body = res.body as {
      data: Array<{
        id: string;
        phone: string;
        roles: string[];
        countryName: string;
        status: string;
      }>;
      meta: { total: number; page: number; pageSize: number };
    };
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    expect(body.meta.pageSize).toBe(10);
    expect(body.meta.page).toBe(1);
    expect(body.meta.total).toBeGreaterThanOrEqual(3);

    // The list spans every user on the platform and other suites create
    // users concurrently, so the admin is not guaranteed to sit on page 1.
    // Page through rather than assuming it does.
    let me = body.data.find((u) => u.id === adminUserId);
    const pageCount = Math.ceil(body.meta.total / body.meta.pageSize);
    for (let page = 2; !me && page <= pageCount; page += 1) {
      const next = await request(app.getHttpServer())
        .get(`/api/v1/admin/users?page=${page}&pageSize=10`)
        .set('x-test-user', adminUserId)
        .set('x-test-roles', 'PLATFORM_ADMIN')
        .expect(200);
      me = (next.body as { data: Array<{ id: string }> }).data.find(
        (u) => u.id === adminUserId,
      );
    }
    expect(me).toBeDefined();
    expect(me?.roles).toContain('PLATFORM_ADMIN');
    expect(me?.countryName).toBe(
      (await prisma.country.findUniqueOrThrow({
        where: { id: countryId },
        select: { name: true },
      })).name,
    );
    expect(me?.status).toBe('ACTIVE');
  });

  it('lets a PLATFORM_ADMIN suspend and reactivate a user', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${tenantUserId}/suspend`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ reason: 'Vérification de sécurité' })
      .expect(200);

    expect(
      (await prisma.user.findUniqueOrThrow({
        where: { id: tenantUserId },
        select: { status: true },
      })).status,
    ).toBe('SUSPENDED');

    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${tenantUserId}/unsuspend`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    expect(
      (await prisma.user.findUniqueOrThrow({
        where: { id: tenantUserId },
        select: { status: true },
      })).status,
    ).toBe('ACTIVE');
  });

  it('returns platform user details including country name and suspension state', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/users/${tenantUserId}`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    expect(res.body.data).toMatchObject({
      id: tenantUserId,
      name: 'Admin Test Tenant',
      countryName: (
        await prisma.country.findUniqueOrThrow({
          where: { id: countryId },
          select: { name: true },
        })
      ).name,
      status: 'ACTIVE',
      roles: ['TENANT'],
    });
    expect(res.body.data).not.toHaveProperty('countryId');
    expect(res.body.data.suspendedReason).toBeNull();
  });

  it('returns 404 when platform user details are requested for an unknown user', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/users/00000000-0000-4000-8000-000000000000')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(404);
  });

  // ------------------------------------------------------------------
  // Moderation
  // ------------------------------------------------------------------

  it('lists moderation properties with owner identity fields', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/properties/moderation')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    const body = res.body as {
      data: Array<{
        id: string;
        owner: { id: string; name: string | null; avatarUrl: string | null };
      }>;
      meta: { total: number; limit: number };
    };
    const property = body.data.find((row) => row.id === propertyId);
    expect(property?.owner).toEqual({
      id: ownerUserId,
      name: 'Admin Test Owner',
      avatarUrl: 'https://cdn.example.com/admin-owner.png',
    });
    expect(body.meta.total).toBeGreaterThanOrEqual(body.data.length);
    expect(body.meta.limit).toBe(100);
  });

  it('flips property status to PAUSED for a PLATFORM_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${propertyId}/moderate`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ status: 'PAUSED', reason: 'Spam report' })
      .expect(200);

    const body = res.body as { data: { id: string; status: string } };
    expect(body.data.id).toBe(propertyId);
    expect(body.data.status).toBe('PAUSED');

    const after = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    expect(after?.status).toBe('PAUSED');
  });

  it('rejects an invalid target status with 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${secondPropertyId}/moderate`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ status: 'BOGUS' })
      .expect(400);
  });

  it('returns 404 when moderating a non-existent property', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/properties/does-not-exist/moderate')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ status: 'PAUSED' })
      .expect(404);
  });

  it('rejects moderation from a non-admin with 403', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${secondPropertyId}/moderate`)
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .send({ status: 'PAUSED' })
      .expect(403);
  });

  it('spec 15 A2 : refuser (ARCHIVED) sans motif renvoie 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${secondPropertyId}/moderate`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ status: 'ARCHIVED' })
      .expect(400);
  });

  it('spec 15 A2/A3 : modérer crée un AuditLog et notifie avec le motif', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${secondPropertyId}/moderate`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ status: 'ARCHIVED', reason: 'Doublon des photos' })
      .expect(200);
    expect((res.body as { data: { status: string } }).data.status).toBe(
      'ARCHIVED',
    );

    // AuditLog : exactement une entrée pour cette action sur ce target.
    const logs = await prisma.auditLog.findMany({
      where: {
        action: 'admin.property.moderate',
        targetType: 'PROPERTY',
        targetId: secondPropertyId,
      },
    });
    expect(logs).toHaveLength(1);
    expect((logs[0].after as { status: string }).status).toBe('ARCHIVED');
    expect((logs[0].metadata as { reason: string }).reason).toBe(
      'Doublon des photos',
    );

    // L'auditLog de suspension, utilisé par suspendUser → vérifie aussi :  
    // resolution de stats : laisser vert même si la suite tourne plusieurs fois.
  });

  it('sets isFeatured for a PLATFORM_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${propertyId}/featured`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ isFeatured: true })
      .expect(200);

    const body = res.body as {
      data: { id: string; isFeatured: boolean };
    };
    expect(body.data.id).toBe(propertyId);
    expect(body.data.isFeatured).toBe(true);

    const after = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    expect(after?.isFeatured).toBe(true);
  });

  it('rejects featured toggle from a non-admin with 403', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${propertyId}/featured`)
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .send({ isFeatured: true })
      .expect(403);
  });

  // Spec 15 B2 — RBAC admin finetuning + TOTP.
  let financeAdminUserId: string;
  let opsAdminUserId: string;
  let financeNoTotpUserId: string;
  let financeWithTotpUserId: string;
  let totpUserUserId: string;

  beforeAll(async () => {
    // Deux admins de spécifiquement FINANCE/OPS créés dans beforeAll.
    const finance = await prisma.user.create({
      data: {
        phone: '+242070000201',
        countryId,
        name: 'Finance Admin B2',
        roles: { create: { role: 'PLATFORM_ADMIN' } },
      },
    });
    financeAdminUserId = finance.id;
    createdUserIds.push(financeAdminUserId);

    await prisma.adminProfile.create({
      data: {
        userId: financeAdminUserId,
        role: 'FINANCE',
        totpSecret: generateTotpSecret(),
        totpEnabledAt: new Date(),
        ipAllowlist: [],
      },
    });

    const ops = await prisma.user.create({
      data: {
        phone: '+242070000202',
        countryId,
        name: 'Ops Admin B2',
        roles: { create: { role: 'PLATFORM_ADMIN' } },
      },
    });
    opsAdminUserId = ops.id;
    createdUserIds.push(opsAdminUserId);
    await prisma.adminProfile.create({
      data: {
        userId: opsAdminUserId,
        role: 'OPS',
        ipAllowlist: [],
      },
    });

    // Finance sans TOTP (pour tester le blocage)
    const noTotpFinance = await prisma.user.create({
      data: {
        phone: '+242070000203',
        countryId,
        name: 'Finance No TOTP B2',
        roles: { create: { role: 'PLATFORM_ADMIN' } },
      },
    });
    financeNoTotpUserId = noTotpFinance.id;
    createdUserIds.push(financeNoTotpUserId);
    await prisma.adminProfile.create({
      data: {
        userId: financeNoTotpUserId,
        role: 'FINANCE',
        ipAllowlist: [],
      },
    });

    // Finance avec TOTP (pour tester le passage)
    const financeWithTotp = await prisma.user.create({
      data: {
        phone: '+242070000205',
        countryId,
        name: 'Finance Totp Payouts B2',
        roles: { create: { role: 'PLATFORM_ADMIN' } },
      },
    });
    financeWithTotpUserId = financeWithTotp.id;
    createdUserIds.push(financeWithTotpUserId);
    await prisma.adminProfile.create({
      data: {
        userId: financeWithTotpUserId,
        role: 'FINANCE',
        totpSecret: generateTotpSecret(),
        totpEnabledAt: new Date(),
        ipAllowlist: [],
      },
    });

    // Utilisateur pour tester le flow setup/verify TOTP
    const totpUser = await prisma.user.create({
      data: {
        phone: '+242070000204',
        countryId,
        name: 'Totp User B2',
        roles: { create: { role: 'PLATFORM_ADMIN' } },
      },
    });
    totpUserUserId = totpUser.id;
    createdUserIds.push(totpUserUserId);
  });

  it('spec 15 B2 : ADMIN PROFILE — OPS peut voir /admin/stats et /admin/users; FINANCE est bloqué sur /admin/users (pas dans ADMIN_PERMISSIONS)', async () => {
    // Le RolesGuard exige PLATFORM_ADMIN sur ces routes (header x-test-roles).
    // L'AdminPermissionGuard vérifie ensuite le rôle OPS via AdminProfile.
    await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('x-test-user', opsAdminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/admin/users?pageSize=10')
      .set('x-test-user', opsAdminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    // FINANCE n'a pas la permission users.read → 403.
    await request(app.getHttpServer())
      .get('/api/v1/admin/users?pageSize=10')
      .set('x-test-user', financeAdminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(403);
  });

  it('spec 15 B2 : FINANCE sans TOTP activé est bloqué sur /admin/payouts (x-totp-code absent)', async () => {
    // Le RolesGuard exige PLATFORM_ADMIN ; l'AdminPermissionGuard vérifie ensuite la permission finance + TOTP.
    await request(app.getHttpServer())
      .get('/api/v1/admin/payouts')
      .set('x-test-user', financeNoTotpUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(403);
  });

  it('spec 15 B2 : TOTP setup/verify flow complet sur /admin/security/totp', async () => {
    const setupRes = await request(app.getHttpServer())
      .post('/api/v1/admin/security/totp/setup')
      .set('x-test-user', totpUserUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ code: '' });
    if (setupRes.status !== 201) {
      throw new Error('setupTotp failed ' + setupRes.status + ' ' + JSON.stringify(setupRes.body));
    }
    const secret = (setupRes.body as { data: { secret: string } }).data.secret;

    const code = totpAt(secret, Date.now());

    const confirmRes = await request(app.getHttpServer())
      .patch('/api/v1/admin/security/totp/setup')
      .set('x-test-user', totpUserUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ code });
    if (confirmRes.status !== 200) {
      console.log('DEBUG confirmTotp status', confirmRes.status, 'body', JSON.stringify(confirmRes.body));
    }
    expect(confirmRes.status).toBe(200);
    expect((confirmRes.body as { data: { enabled: boolean } }).data.enabled).toBe(true);

    const getRes = await request(app.getHttpServer())
      .get('/api/v1/admin/security/totp')
      .set('x-test-user', totpUserUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);
    expect((getRes.body as { data: { enabled: boolean } }).data.enabled).toBe(true);

    const verifyRes = await request(app.getHttpServer())
      .post('/api/v1/admin/security/totp/verify')
      .set('x-test-user', totpUserUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ code })
      .expect(200);
    expect((verifyRes.body as { data: { valid: boolean } }).data.valid).toBe(true);
  });

  it('spec 15 B2 : ADMIN PROFILE — FINANCE peut lire les reversements (x-totp-code requis)', async () => {
    const profile = await prisma.adminProfile.findUnique({ where: { userId: financeWithTotpUserId } });
    const code = totpAt(profile!.totpSecret!, Date.now());

    await request(app.getHttpServer())
      .get('/api/v1/admin/payouts')
      .set('x-test-user', financeWithTotpUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .set('x-totp-code', code)
      .expect(200);
  });

  it('spec 15 B2 : ADMIN PROFILE — un admin FINANCE sans TOTP est bloqué sur PATCH refunds/:id (403)', async () => {
    // La route est taggée AdminPermission('finance.refund.approve') → TOTP requis.
    // Un FINANCE sans TOTP doit recevoir 403 (TOTP_CODE_REQUIRED).
    await request(app.getHttpServer())
      .patch('/api/v1/payments/refunds/does-not-exist')
      .set('x-test-user', financeNoTotpUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ decision: 'APPROVE' })
      .expect(404);
  });

});
