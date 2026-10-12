import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  PayoutAccountsController,
  PayoutSettingsController,
} from './payout-accounts.controller';
import { PayoutsService } from './payouts.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AdminPermissionGuard } from '../admin/admin-permission.guard';

/**
 * Passe négative HTTP — comptes et réglages de reversement (spec 05).
 * Les routes `organizations/:id/payout-accounts|payout-settings` ne
 * transitent pas par OrgContextGuard : la protection vit dans
 * PayoutsService.assertCanManageAccounts. On épingle le comportement HTTP
 * pour un membre désactivé, un mauvais rôle, et un utilisateur hors org.
 */
describe('Payout accounts HTTP — passe négative', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let orgOwnerId: string;
  let gerantId: string;
  let agentId: string;
  let disabledId: string;
  let outsiderId: string;
  let otherOrgOwnerId: string;
  let orgId: string;
  let otherOrgId: string;
  let accountId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PayoutAccountsController, PayoutSettingsController],
      providers: [
        PayoutsService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
        { provide: AdminPermissionGuard, useValue: { canActivate: () => true } },
      ],
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
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;

    const phones = [
      '+242071200001', // org owner (non membre, propriétaire de bien → positif)
      '+242071200002', // gérant ADMIN actif
      '+242071200003', // agent AGENT actif (mauvais rôle)
      '+242071200004', // agent désactivé
      '+242071200005', // outsider
      '+242071200006', // owner d'une autre org
    ];
    // Self-healing purge: leftover org memberships from a crashed previous
    // run would block the user delete via FK `OrganizationMember_userId_fkey`.
    const stale = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.payoutAccount.deleteMany({
        where: { organization: { members: { some: { userId: { in: staleIds } } } } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const [propOwner, gerant, agent, disabled, outsider, otherOwner] =
      await Promise.all(
        phones.map((phone, i) =>
          prisma.user.create({
            data: {
              phone,
              countryId,
              name: `Payout HTTP ${i}`,
              roles: { create: { role: 'TENANT' } },
            },
          }),
        ),
      );
    orgOwnerId = propOwner.id;
    gerantId = gerant.id;
    agentId = agent.id;
    disabledId = disabled.id;
    outsiderId = outsider.id;
    otherOrgOwnerId = otherOwner.id;

    const org = await prisma.organization.create({
      data: {
        name: `Payout HTTP Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: {
          create: [
            { userId: gerantId, role: 'ADMIN', status: 'ACTIVE' },
            { userId: agentId, role: 'AGENT', status: 'ACTIVE' },
            { userId: disabledId, role: 'AGENT', status: 'DISABLED' },
          ],
        },
      },
    });
    orgId = org.id;

    // Un bien de l'org détenu par propOwner (non membre) → la branche
    // "propriétaire d'un bien de l'orga" reste autorisée à gérer.
    const property = await prisma.property.create({
      data: {
        title: 'Payout HTTP Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: (
          await prisma.quartier.findFirst({
            where: { arrondissement: { city: { name: 'Brazzaville' } } },
          })
        )!.id,
        address: 'Test',
        countryId,
        ownerId: orgOwnerId,
        organizationId: orgId,
        status: 'ACTIVE',
      },
    });
    void property;

    const otherOrg = await prisma.organization.create({
      data: {
        name: `Payout HTTP Other Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: otherOrgOwnerId, role: 'ADMIN' } },
      },
    });
    otherOrgId = otherOrg.id;

    accountId = (
      await prisma.payoutAccount.create({
        data: {
          organizationId: orgId,
          type: 'MOBILE_MONEY',
          provider: 'AIRTEL',
          phone: '+242066000999',
          holderName: 'Titulaire test',
          isDefault: true,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.payoutAccount.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } }).catch(() => undefined);
    await prisma.property.deleteMany({ where: { organizationId: orgId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } }).catch(() => undefined);
    const ids = [orgOwnerId, gerantId, agentId, disabledId, outsiderId, otherOrgOwnerId].filter(Boolean);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await app.close();
    await prisma.onModuleDestroy();
  });

  it('GET accounts refusé pour un membre désactivé (MEMBER_DISABLED 403)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/payout-accounts`)
      .set('x-test-user', disabledId)
      .expect(403);
    expect(res.body.code).toBe('PAYOUT_ACCOUNT_FORBIDDEN');
  });

  it('GET settings refusé pour un membre désactivé (403)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/payout-settings`)
      .set('x-test-user', disabledId)
      .expect(403);
  });

  it('PATCH settings refusé pour un agent actif (mauvais rôle, 403)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/payout-settings`)
      .set('x-test-user', agentId)
      .send({ payoutFrequency: 'MONTHLY', minPayoutAmount: 50000 })
      .expect(403);
    expect(res.body.code).toBe('PAYOUT_ACCOUNT_FORBIDDEN');
  });

  it('POST account refusé pour un agent actif (mauvais rôle, 403)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/payout-accounts`)
      .set('x-test-user', agentId)
      .send({
        type: 'MOBILE_MONEY',
        phone: '+242066111222',
        holderName: 'Agent',
      })
      .expect(403);
  });

  it('DELETE account refusé pour un agent actif (mauvais rôle, 403)', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgId}/payout-accounts/${accountId}`)
      .set('x-test-user', agentId)
      .expect(403);
  });

  it('un utilisateur hors org n\'a aucun accès (403, pas de fuite de données)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/payout-accounts`)
      .set('x-test-user', outsiderId)
      .expect(403);
    expect(res.body.code).toBe('PAYOUT_ACCOUNT_FORBIDDEN');

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/payout-settings`)
      .set('x-test-user', outsiderId)
      .expect(403);

    // L'owner d'une AUTRE org ne peut pas davantage muter celle-ci.
    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/payout-settings`)
      .set('x-test-user', otherOrgOwnerId)
      .send({ payoutFrequency: 'MONTHLY', minPayoutAmount: 1 })
      .expect(403);
  });

  it('contrôle positif : gérant ADMIN voit et modifie ; owner de bien aussi', async () => {
    // Gérant ADMIN de l'org.
    const list = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/payout-accounts`)
      .set('x-test-user', gerantId)
      .expect(200);
    expect(Array.isArray(list.body)).toBe(true);
    expect(list.body.some((a: { id: string }) => a.id === accountId)).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/payout-settings`)
      .set('x-test-user', gerantId)
      .send({ payoutFrequency: 'MONTHLY', minPayoutAmount: 10000 })
      .expect(200);

    // Propriétaire d'un bien de l'org (non membre) : autorisé aussi.
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/payout-settings`)
      .set('x-test-user', orgOwnerId)
      .expect(200);
  });
});
