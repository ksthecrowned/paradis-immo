import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuditLogService } from '../common/audit-log.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyClientsController } from './agency-clients.controller';
import { AgencyClientsService } from './agency-clients.service';

describe('Agency clients HTTP — CRM access matrix', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let gerantId: string;
  let agentId: string;
  let disabledId: string;
  let outsiderId: string;
  let otherOrgGerantId: string;
  let targetUserId: string;
  let orgId: string;
  let otherOrgId: string;
  const suffix = String(Date.now()).slice(-8);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AgencyClientsController],
      providers: [
        AgencyClientsService,
        AgencyAccessService,
        AuditLogService,
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
      }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Seed CG required');
    countryId = cg.id;

    const phones = [
      `+242072${suffix}1`,
      `+242072${suffix}2`,
      `+242072${suffix}3`,
      `+242072${suffix}4`,
      `+242072${suffix}5`,
      `+242072${suffix}6`,
    ];
    const [gerant, agent, disabled, outsider, otherGerant, target] =
      await Promise.all(
        phones.map((phone, i) =>
          prisma.user.create({
            data: {
              phone,
              countryId,
              name: `CRM HTTP ${i}`,
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
    targetUserId = target.id;

    const org = await prisma.organization.create({
      data: {
        name: `CRM HTTP Org ${suffix}`,
        type: 'AGENCY',
        countryId,
        shortName: `ch${suffix}`.slice(0, 20),
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
        name: `CRM HTTP Other ${suffix}`,
        type: 'AGENCY',
        countryId,
        shortName: `co${suffix}`.slice(0, 20),
        members: {
          create: { userId: otherOrgGerantId, role: 'ADMIN', status: 'ACTIVE' },
        },
      },
    });
    otherOrgId = otherOrg.id;
  });

  afterAll(async () => {
    await prisma.agencyClient
      .deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } })
      .catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({ where: { organizationId: { in: [orgId, otherOrgId] } } })
      .catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { id: { in: [orgId, otherOrgId] } } })
      .catch(() => undefined);
    const ids = [
      gerantId,
      agentId,
      disabledId,
      outsiderId,
      otherOrgGerantId,
      targetUserId,
    ].filter(Boolean);
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await app.close();
    await prisma.onModuleDestroy();
  });

  it('ADMIN creates external contact; AGENT cannot create/edit/archive', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/clients/external`)
      .set('x-test-user', gerantId)
      .send({
        displayName: 'External Contact',
        phone: `+242073${suffix}1`,
      })
      .expect(201);
    expect(created.body.userId).toBeNull();
    expect(created.body.hasAccount).toBe(false);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/clients/external`)
      .set('x-test-user', agentId)
      .send({
        displayName: 'Agent attempt',
        phone: `+242073${suffix}2`,
      })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${orgId}/clients/${created.body.id}`)
      .set('x-test-user', agentId)
      .send({ displayName: 'Nope' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/clients/${created.body.id}/archive`)
      .set('x-test-user', agentId)
      .expect(403);

    // AGENT may list / select
    const list = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/clients`)
      .set('x-test-user', agentId)
      .expect(200);
    expect(list.body.data.some((c: { id: string }) => c.id === created.body.id)).toBe(
      true,
    );

    const selectable = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/clients/selectable`)
      .set('x-test-user', agentId)
      .expect(200);
    expect(Array.isArray(selectable.body)).toBe(true);
  });

  it('rejects other agency, outsider, disabled admin, and duplicate phone', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/clients`)
      .set('x-test-user', outsiderId)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/clients`)
      .set('x-test-user', otherOrgGerantId)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/clients/external`)
      .set('x-test-user', disabledId)
      .send({ displayName: 'Disabled', phone: `+242073${suffix}3` })
      .expect(403);

    const phone = `+242073${suffix}4`;
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/clients/external`)
      .set('x-test-user', gerantId)
      .send({ displayName: 'First', phone })
      .expect(201);

    const dup = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/clients/external`)
      .set('x-test-user', gerantId)
      .send({ displayName: 'Dup', phone })
      .expect(409);
    expect(dup.body.code).toBe('AGENCY_CLIENT_DUPLICATE');
  });

  it('lookup is minimal; link notifies account; guessed id from other org 404', async () => {
    const phone = `+242072${suffix}6`;
    const lookup = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/clients/lookup`)
      .set('x-test-user', gerantId)
      .send({ phone })
      .expect(200);
    expect(lookup.body.exists).toBe(true);
    expect(lookup.body.userId).toBe(targetUserId);
    expect(lookup.body.displayName).toMatch(/CRM/);
    expect(lookup.body).not.toHaveProperty('email');
    expect(lookup.body).not.toHaveProperty('roles');

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/clients/lookup`)
      .set('x-test-user', agentId)
      .send({ phone })
      .expect(403);

    const linked = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${orgId}/clients/link`)
      .set('x-test-user', gerantId)
      .send({ phone })
      .expect(201);
    expect(linked.body.userId).toBe(targetUserId);
    expect(linked.body.linkStatus).toBe('LINKED');

    const notif = await prisma.notification.findFirst({
      where: { userId: targetUserId, type: 'AGENCY_CLIENT_CRM_ADDED' },
    });
    expect(notif).toBeTruthy();

    const foreign = await prisma.agencyClient.create({
      data: {
        organizationId: otherOrgId,
        displayName: 'Foreign',
        phoneE164: `+242073${suffix}9`,
        createdById: otherOrgGerantId,
      },
    });
    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgId}/clients/${foreign.id}`)
      .set('x-test-user', gerantId)
      .expect(404);
  });
});
