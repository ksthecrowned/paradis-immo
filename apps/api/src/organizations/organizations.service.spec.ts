import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrganizationsService } from './organizations.service';
import { EventPublisher } from '../events/event.publisher';
import { SEED_IDS } from '../common/constants/seed-ids';

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
      const owned = await prisma.organization.findMany({
        where: { members: { some: { userId } } },
        select: { id: true },
      });
      await prisma.organizationMember.deleteMany({ where: { userId } });
      if (owned.length) {
        await prisma.organization.deleteMany({
          where: { id: { in: owned.map((o) => o.id) } },
        });
      }
      await prisma.userRole.deleteMany({ where: { userId } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.onModuleDestroy();
  });

  it('getParadisImmo returns the seeded org', async () => {
    const paradis = await orgs.getParadisImmo();
    expect(paradis.id).toBe(SEED_IDS.orgParadisImmo);
    expect(paradis.type).toBe('PLATFORM');
    expect(paradis.isOfficial).toBe(true);
  });

  it('listPublic returns official first and excludes OWNER orgs', async () => {
    const { data } = await orgs.listPublic();
    expect(data.length).toBeGreaterThanOrEqual(3);
    expect(data[0]?.isOfficial).toBe(true);
    expect(data[0]?.id).toBe(SEED_IDS.orgParadisImmo);
    expect(data.every((o) => o.type !== 'OWNER')).toBe(true);
  });

  it('getPublic includes agents with user ids', async () => {
    const detail = await orgs.getPublic(SEED_IDS.orgParadisImmo);
    expect(detail.agents.length).toBeGreaterThanOrEqual(2);
    expect(detail.agents[0]?.id).toBeTruthy();
    expect(detail.shortName).toBe('Paradis Immo');
  });

  it('getPublic 404s for OWNER org', async () => {
    await expect(orgs.getPublic(SEED_IDS.orgOwner)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('refuses when no OWNER organization was opened by an admin (spec 02)', async () => {
    await expect(orgs.ensureOwnerOrg(userId, countryId)).rejects.toMatchObject({
      response: { code: 'OWNER_ORG_REQUIRED' },
    });
  });

  it('returns the OWNER organization created from the admin invitation', async () => {
    const org = await prisma.organization.create({
      data: {
        name: `Owner Org Spec02 ${userId.slice(0, 8)}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId, role: 'OWNER' } },
      },
    });

    const resolved = await orgs.ensureOwnerOrg(userId, countryId);
    expect(resolved.id).toBe(org.id);
    expect(resolved.type).toBe('OWNER');

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

  // Regression guard: AGENT membership must never be granted implicitly
  // (spec 01 — escalation of privileges). It comes from an invitation or the
  // creation of an organization only.
  it('never creates an AGENT membership implicitly', async () => {
    const members = await prisma.organizationMember.findMany({
      where: { userId, role: 'AGENT' },
    });
    expect(members).toHaveLength(0);
    expect(
      (orgs as unknown as { ensureAgentMembership?: unknown })
        .ensureAgentMembership,
    ).toBeUndefined();
  });
});
