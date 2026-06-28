import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';
import { EventPublisher } from '../events/event.publisher';

describe('OrganizationsService', () => {
  let orgs: OrganizationsService;
  let prisma: PrismaService;
  let userId: string;
  let countryId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        PrismaService,
        OrganizationsService,
        { provide: JwtService, useValue: {} },
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    orgs = moduleRef.get(OrganizationsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!country) throw new Error('Run seed first');
    countryId = country.id;

    // Create a fresh user
    await prisma.user.deleteMany({ where: { phone: '+242066666666' } });
    const user = await prisma.user.create({
      data: {
        phone: '+242066666666',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    if (userId) {
      await prisma.organizationMember.deleteMany({ where: { userId } });
      await prisma.organization.deleteMany({
        where: { members: { some: { userId } } },
      });
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.onModuleDestroy();
  });

  it('getParadisImmo returns the seeded org', async () => {
    const paradis = await orgs.getParadisImmo();
    expect(paradis.id).toBe('org_paradis_immo');
    expect(paradis.type).toBe('AGENCY');
  });

  it('ensureOwnerOrg creates a personal OWNER org + member', async () => {
    const org = await orgs.ensureOwnerOrg(userId, countryId);
    expect(org.type).toBe('OWNER');
    expect(org.countryId).toBe(countryId);
    const member = await prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: org.id,
        },
      },
    });
    expect(member?.role).toBe('OWNER');
  });

  it('ensureOwnerOrg is idempotent', async () => {
    const first = await orgs.ensureOwnerOrg(userId, countryId);
    const second = await orgs.ensureOwnerOrg(userId, countryId);
    expect(second.id).toBe(first.id);
  });

  it('ensureAgentMembership adds AGENT to Paradis Immo', async () => {
    const m = await orgs.ensureAgentMembership(userId);
    expect(m.role).toBe('AGENT');
    expect(m.organizationId).toBe('org_paradis_immo');
  });

  it('ensureAgentMembership is idempotent', async () => {
    const first = await orgs.ensureAgentMembership(userId);
    const second = await orgs.ensureAgentMembership(userId);
    expect(second.userId).toBe(first.userId);
    expect(second.organizationId).toBe(first.organizationId);
  });
});
