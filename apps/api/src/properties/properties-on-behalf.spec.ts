import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import {
  OrgMemberRole,
  OrganizationType,
  MandateStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { PropertiesModule } from './properties.module';

describe('Properties on-behalf create (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let agencyOrgId: string;
  let agentUserId: string;
  let gerantUserId: string;
  let ownerUserId: string;
  let createdPropertyIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PropertiesModule],
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

    const country =
      (await prisma.country.findUnique({ where: { code: 'CG' } })) ??
      (await prisma.country.create({
        data: {
          code: 'CG',
          name: 'Congo',
          currency: 'XAF',
          phonePrefix: '+242',
          activeProviders: ['AIRTEL'],
        },
      }));
    countryId = country.id;

    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Seed Brazzaville quartiers first');
    bzvQuartierId = quartier.id;

    const phones = [
      '+242076010001',
      '+242076010002',
      '+242076010003',
      '+242076010099',
    ];
    const leftovers = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const leftoverIds = leftovers.map((u) => u.id);
    if (leftoverIds.length > 0) {
      await prisma.mandate.deleteMany({
        where: {
          OR: [
            { assignedAgentId: { in: leftoverIds } },
            { property: { ownerId: { in: leftoverIds } } },
          ],
        },
      });
      await prisma.property.deleteMany({
        where: { ownerId: { in: leftoverIds } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: leftoverIds } },
      });
      await prisma.organization.deleteMany({
        where: {
          type: OrganizationType.OWNER,
          members: { some: { userId: { in: leftoverIds } } },
        },
      });
      await prisma.userRole.deleteMany({
        where: { userId: { in: leftoverIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: leftoverIds } } });
    }

    const agency = await prisma.organization.create({
      data: {
        name: `Agency OnBehalf ${Date.now()}`,
        type: OrganizationType.AGENCY,
        countryId,
      },
    });
    agencyOrgId = agency.id;

    const agent = await prisma.user.create({
      data: {
        phone: '+242076010001',
        name: 'Agent Terrain',
        countryId,
        roles: { create: { role: 'TENANT' } },
        orgMembers: {
          create: {
            organizationId: agencyOrgId,
            role: OrgMemberRole.AGENT,
          },
        },
      },
    });
    agentUserId = agent.id;

    const gerant = await prisma.user.create({
      data: {
        phone: '+242076010002',
        name: 'Gérant Agence',
        countryId,
        roles: { create: { role: 'TENANT' } },
        orgMembers: {
          create: {
            organizationId: agencyOrgId,
            role: OrgMemberRole.ADMIN,
          },
        },
      },
    });
    gerantUserId = gerant.id;

    const owner = await prisma.user.create({
      data: {
        phone: '+242076010003',
        name: 'Owner Cible',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
  });

  afterAll(async () => {
    const ids = [agentUserId, gerantUserId, ownerUserId].filter(Boolean);
    if (createdPropertyIds.length > 0) {
      await prisma.mandate.deleteMany({
        where: { propertyId: { in: createdPropertyIds } },
      });
      await prisma.property.deleteMany({
        where: { id: { in: createdPropertyIds } },
      });
    }
    if (agencyOrgId) {
      await prisma.organizationMember.deleteMany({
        where: { organizationId: agencyOrgId },
      });
      await prisma.organization.deleteMany({ where: { id: agencyOrgId } });
    }
    if (ownerUserId) {
      await prisma.organizationMember.deleteMany({
        where: { userId: ownerUserId },
      });
      await prisma.organization.deleteMany({
        where: {
          members: { some: { userId: ownerUserId } },
          type: 'OWNER',
        },
      });
    }
    const orphan = await prisma.user.findFirst({
      where: { phone: '+242076010099' },
    });
    if (orphan) {
      await prisma.mandate.deleteMany({
        where: { property: { ownerId: orphan.id } },
      });
      await prisma.property.deleteMany({ where: { ownerId: orphan.id } });
      await prisma.organizationMember.deleteMany({
        where: { userId: orphan.id },
      });
      await prisma.organization.deleteMany({
        where: { members: { some: { userId: orphan.id } }, type: 'OWNER' },
      });
      await prisma.userRole.deleteMany({ where: { userId: orphan.id } });
      await prisma.user.delete({ where: { id: orphan.id } });
    }
    if (ids.length > 0) {
      await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app.close();
    await prisma.onModuleDestroy();
  });

  const baseBody = () => ({
    title: 'Bien agence pour owner',
    description: 'Créé par un agent pour un propriétaire',
    type: 'APARTMENT',
    mode: 'RENT_LONG',
    price: 200000,
    currency: 'XAF',
    priceUnit: 'MONTH',
    quartierId: bzvQuartierId,
    address: 'Avenue de la Paix',
    countryId,
  });

  it('agent creates property for ownerId + auto-mandate assigned to self', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('x-test-user', agentUserId)
      .send({ ...baseBody(), ownerId: ownerUserId })
      .expect(201);

    createdPropertyIds.push(res.body.id);
    expect(res.body.ownerId).toBe(ownerUserId);

    const mandate = await prisma.mandate.findFirst({
      where: { propertyId: res.body.id, status: MandateStatus.ACTIVE },
    });
    expect(mandate).toBeTruthy();
    expect(mandate!.organizationId).toBe(agencyOrgId);
    expect(mandate!.assignedAgentId).toBe(agentUserId);

    const managed = await request(app.getHttpServer())
      .get('/api/v1/properties/managed')
      .set('x-test-user', agentUserId)
      .expect(200);
    expect(managed.body.data.some((p: { id: string }) => p.id === res.body.id)).toBe(
      true,
    );
  });

  it('gerant creates via ownerPhone without assignedAgentId', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('x-test-user', gerantUserId)
      .send({
        ...baseBody(),
        title: 'Bien gérant phone owner',
        ownerPhone: '+242076010099',
        ownerName: 'Nouveau Owner',
      })
      .expect(201);

    createdPropertyIds.push(res.body.id);
    const mandate = await prisma.mandate.findFirst({
      where: { propertyId: res.body.id },
    });
    expect(mandate!.assignedAgentId).toBeNull();
    expect(mandate!.organizationId).toBe(agencyOrgId);
    expect(res.body.ownerId).not.toBe(gerantUserId);
  });

  it('rejects on-behalf create from non-agency user', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('x-test-user', ownerUserId)
      .send({ ...baseBody(), ownerPhone: '+242076010099', ownerName: 'X' })
      .expect(403);
  });
});
