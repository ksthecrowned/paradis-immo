import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { LeaseTemplatesController } from './lease-templates.controller';
import { LeaseTemplatesService } from './lease-templates.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Passe négative HTTP — modèles de bail d'agence (spec 04 P2).
 * Les routes `organizations/:organizationId/lease-templates` protègent via
 * AgencyAccessService.assertIsAgencyGerant (ADMIN actif strict). On épingle
 * le comportement HTTP pour un membre désactivé, un mauvais rôle (AGENT
 * actif) et un utilisateur hors org — la lecture partagée n'ouvre pas ici
 * une seule mutation.
 */
describe('Lease templates HTTP — passe négative', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let gerantId: string;
  let agentId: string;
  let disabledId: string;
  let outsiderId: string;
  let otherOrgGerantId: string;
  let orgId: string;
  let otherOrgId: string;
  let templateId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LeaseTemplatesController],
      providers: [
        LeaseTemplatesService,
        AgencyAccessService,
        PrismaService,
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
      '+242071300001', // gérant ADMIN actif
      '+242071300002', // agent AGENT actif (mauvais rôle)
      '+242071300003', // agent désactivé
      '+242071300004', // outsider
      '+242071300005', // gérant d'une autre org
    ];
    // Self-healing purge: leftover org memberships from a crashed previous
    // run would block the user delete via FK `OrganizationMember_userId_fkey`.
    const stale = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.leaseTemplate.deleteMany({
        where: { organization: { members: { some: { userId: { in: staleIds } } } } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const [gerant, agent, disabled, outsider, otherGerant] = await Promise.all(
      phones.map((phone, i) =>
        prisma.user.create({
          data: {
            phone,
            countryId,
            name: `LeaseTpl HTTP ${i}`,
            roles: { create: { role: 'TENANT' } },
          },
        }),
      ),
    );
    gerantId = gerant.id;
    agentId = agent.id;
    disabledId = disabled.id;
    outsiderId = outsider.id;
    otherOrgGerantId = otherGerant.id;

    const org = await prisma.organization.create({
      data: {
        name: `LeaseTpl HTTP Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: {
          create: [
            { userId: gerantId, role: 'ADMIN', status: 'ACTIVE' },
            { userId: agentId, role: 'AGENT', status: 'ACTIVE' },
            { userId: disabledId, role: 'ADMIN', status: 'DISABLED' },
          ],
        },
      },
    });
    orgId = org.id;

    const otherOrg = await prisma.organization.create({
      data: {
        name: `LeaseTpl HTTP Other Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: otherOrgGerantId, role: 'ADMIN' } },
      },
    });
    otherOrgId = otherOrg.id;

    templateId = (
      await prisma.leaseTemplate.create({
        data: {
          organizationId: orgId,
          name: 'Contrat HTTP',
          body: 'Loyer {{loyer}}',
          isDefault: true,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.leaseTemplate.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } }).catch(() => undefined);
    await prisma.organization.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } }).catch(() => undefined);
    const ids = [gerantId, agentId, disabledId, outsiderId, otherOrgGerantId].filter(Boolean);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await app.close();
    await prisma.onModuleDestroy();
  });

  it('GET templates refuse un agent AGENT actif (NOT_AGENCY_GERANT 403)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/lease-templates`)
      .set('x-test-user', agentId)
      .expect(403);
    expect(res.body.code).toBe('NOT_AGENCY_GERANT');
  });

  it('GET templates refuse un membre ADMIN désactivé (403)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/lease-templates`)
      .set('x-test-user', disabledId)
      .expect(403);
    expect(res.body.code).toBe('NOT_AGENCY_GERANT');
  });

  it('POST / PATCH / DELETE refusés pour un agent actif (mauvais rôle, 403)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/lease-templates`)
      .set('x-test-user', agentId)
      .send({ name: 'Agent attempt', body: 'Corps du contrat assez long' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/lease-templates/${templateId}`)
      .set('x-test-user', agentId)
      .send({ name: 'Agent rename' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${orgId}/lease-templates/${templateId}`)
      .set('x-test-user', agentId)
      .expect(403);
  });

  it('un utilisateur hors org n\'a aucun accès (403)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/lease-templates`)
      .set('x-test-user', outsiderId)
      .expect(403);

    // Le gérant d'une AUTRE org ne peut pas non plus muter celle-ci.
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/lease-templates`)
      .set('x-test-user', otherOrgGerantId)
      .send({ name: 'Cross org', body: 'Corps du contrat assez long' })
      .expect(403);

    // Et l'intersection par id : le gérant ne voit que les templates de sa
    // propre org (celui de la première org est invisible).
    const otherList = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${otherOrgId}/lease-templates`)
      .set('x-test-user', otherOrgGerantId)
      .expect(200);
    expect(Array.isArray(otherList.body)).toBe(true);
    expect(
      otherList.body.some((t: { id: string }) => t.id === templateId),
    ).toBe(false);
  });

  it('contrôle positif : le gérant ADMIN lit et crée', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/lease-templates`)
      .set('x-test-user', gerantId)
      .expect(200);
    expect(list.body.some((t: { id: string }) => t.id === templateId)).toBe(true);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/lease-templates`)
      .set('x-test-user', gerantId)
      .send({ name: 'Contrat positif', body: 'Corps du contrat assez long' })
      .expect(201);
    expect(created.body.name).toBe('Contrat positif');
  });
});
