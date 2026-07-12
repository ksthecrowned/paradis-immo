import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { OrgMemberRole, OrganizationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { MandatesModule } from './mandates.module';

describe('Mandates assign (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let quartierId: string;
  let ownerUserId: string;
  let gerantUserId: string;
  let fieldAgentId: string;
  let otherAgentId: string;
  let agencyOrgId: string;
  let ownerOrgId: string;
  let propertyId: string;
  let mandateId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [MandatesModule],
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
    if (!cg) throw new Error('Seed CG');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Seed quartier');
    quartierId = quartier.id;

    const suffix = String(Date.now()).slice(-7);
    ownerUserId = (
      await prisma.user.create({
        data: { phone: `+24209${suffix}1`, countryId, name: 'Assign Owner' },
      })
    ).id;
    gerantUserId = (
      await prisma.user.create({
        data: { phone: `+24209${suffix}2`, countryId, name: 'Assign Gerant' },
      })
    ).id;
    fieldAgentId = (
      await prisma.user.create({
        data: { phone: `+24209${suffix}3`, countryId, name: 'Assign Field' },
      })
    ).id;
    otherAgentId = (
      await prisma.user.create({
        data: { phone: `+24209${suffix}4`, countryId, name: 'Assign Other' },
      })
    ).id;

    ownerOrgId = (
      await prisma.organization.create({
        data: {
          name: `Assign Owner Org ${suffix}`,
          type: OrganizationType.OWNER,
          countryId,
          members: {
            create: { userId: ownerUserId, role: OrgMemberRole.OWNER },
          },
        },
      })
    ).id;

    agencyOrgId = (
      await prisma.organization.create({
        data: {
          name: `Assign Agency ${suffix}`,
          type: OrganizationType.AGENCY,
          countryId,
          shortName: `asg${suffix}`,
          members: {
            create: [
              { userId: gerantUserId, role: OrgMemberRole.ADMIN },
              { userId: fieldAgentId, role: OrgMemberRole.AGENT },
              { userId: otherAgentId, role: OrgMemberRole.AGENT },
            ],
          },
        },
      })
    ).id;

    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Assign Mandate Prop',
          description: 'x',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 1,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId,
          address: 'x',
          countryId,
          ownerId: ownerUserId,
          organizationId: ownerOrgId,
          status: 'ACTIVE',
        },
      })
    ).id;

    mandateId = (
      await prisma.mandate.create({
        data: {
          propertyId,
          organizationId: agencyOrgId,
          status: 'ACTIVE',
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.mandate.deleteMany({ where: { id: mandateId } }).catch(() => undefined);
    await prisma.property.deleteMany({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({
        where: { organizationId: { in: [agencyOrgId, ownerOrgId] } },
      })
      .catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { id: { in: [agencyOrgId, ownerOrgId] } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({
        where: {
          id: {
            in: [ownerUserId, gerantUserId, fieldAgentId, otherAgentId],
          },
        },
      })
      .catch(() => undefined);
    await app.close();
  });

  it('gérant assigns a field agent', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/mandates/${mandateId}/assign`)
      .set('x-test-user', gerantUserId)
      .set('x-test-roles', 'TENANT')
      .send({ agentUserId: fieldAgentId })
      .expect(200);
    expect(res.body.assignedAgentId).toBe(fieldAgentId);
  });

  it('field agent cannot assign', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/mandates/${mandateId}/assign`)
      .set('x-test-user', fieldAgentId)
      .set('x-test-roles', 'TENANT')
      .send({ agentUserId: otherAgentId })
      .expect(403);
  });

  it('managed list is assignment-aware', async () => {
    const gerantList = await request(app.getHttpServer())
      .get('/api/v1/mandates/managed')
      .set('x-test-user', gerantUserId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(gerantList.body.some((m: { id: string }) => m.id === mandateId)).toBe(
      true,
    );

    const fieldList = await request(app.getHttpServer())
      .get('/api/v1/mandates/managed')
      .set('x-test-user', fieldAgentId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(fieldList.body.some((m: { id: string }) => m.id === mandateId)).toBe(
      true,
    );

    const otherList = await request(app.getHttpServer())
      .get('/api/v1/mandates/managed')
      .set('x-test-user', otherAgentId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(otherList.body.some((m: { id: string }) => m.id === mandateId)).toBe(
      false,
    );
  });

  it('gérant can clear assignment', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/mandates/${mandateId}/assign`)
      .set('x-test-user', gerantUserId)
      .set('x-test-roles', 'TENANT')
      .send({ agentUserId: null })
      .expect(200);
    expect(res.body.assignedAgentId).toBeNull();
  });
});
