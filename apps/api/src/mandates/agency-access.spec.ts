import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { OrgMemberRole, OrganizationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from './agency-access.service';

describe('AgencyAccessService', () => {
  let access: AgencyAccessService;
  let prisma: PrismaService;
  let countryId: string;
  let quartierId: string;
  let ownerUserId: string;
  let gerantUserId: string;
  let assignedAgentId: string;
  let unassignedAgentId: string;
  let agencyOrgId: string;
  let ownerOrgId: string;
  let propertyId: string;
  let mandateId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [AgencyAccessService, PrismaService],
    }).compile();
    access = moduleRef.get(AgencyAccessService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Seed CG required');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Seed quartier required');
    quartierId = quartier.id;

    const suffix = String(Date.now()).slice(-7);
    const owner = await prisma.user.create({
      data: {
        phone: `+24208${suffix}1`,
        countryId,
        name: 'Access Owner',
      },
    });
    ownerUserId = owner.id;
    const gerant = await prisma.user.create({
      data: {
        phone: `+24208${suffix}2`,
        countryId,
        name: 'Access Gerant',
      },
    });
    gerantUserId = gerant.id;
    const assigned = await prisma.user.create({
      data: {
        phone: `+24208${suffix}3`,
        countryId,
        name: 'Access Assigned',
      },
    });
    assignedAgentId = assigned.id;
    const unassigned = await prisma.user.create({
      data: {
        phone: `+24208${suffix}4`,
        countryId,
        name: 'Access Unassigned',
      },
    });
    unassignedAgentId = unassigned.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Access Owner Org ${suffix}`,
        type: OrganizationType.OWNER,
        countryId,
        members: {
          create: { userId: ownerUserId, role: OrgMemberRole.OWNER },
        },
      },
    });
    ownerOrgId = ownerOrg.id;

    const agency = await prisma.organization.create({
      data: {
        name: `Access Agency ${suffix}`,
        type: OrganizationType.AGENCY,
        countryId,
        shortName: `acc${suffix}`,
        members: {
          create: [
            { userId: gerantUserId, role: OrgMemberRole.ADMIN },
            { userId: assignedAgentId, role: OrgMemberRole.AGENT },
            { userId: unassignedAgentId, role: OrgMemberRole.AGENT },
          ],
        },
      },
    });
    agencyOrgId = agency.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Access Mandate Prop',
        description: 'agency access fixture',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'Test',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrgId,
        status: 'ACTIVE',
      },
    });
    propertyId = prop.id;

    const mandate = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: agencyOrgId,
        status: 'ACTIVE',
        assignedAgentId,
      },
    });
    mandateId = mandate.id;
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
            in: [
              ownerUserId,
              gerantUserId,
              assignedAgentId,
              unassignedAgentId,
            ],
          },
        },
      })
      .catch(() => undefined);
    await prisma.$disconnect().catch(() => undefined);
  });

  it('allows the property owner', async () => {
    await expect(
      access.assertCanOperateOnProperty(ownerUserId, propertyId),
    ).resolves.toBeUndefined();
  });

  it('allows the agency gérant even when another agent is assigned', async () => {
    await expect(
      access.assertCanOperateOnProperty(gerantUserId, propertyId),
    ).resolves.toBeUndefined();
  });

  it('allows the assigned field agent', async () => {
    await expect(
      access.assertCanOperateOnProperty(assignedAgentId, propertyId),
    ).resolves.toBeUndefined();
  });

  it('forbids an unassigned field agent', async () => {
    await expect(
      access.assertCanOperateOnProperty(unassignedAgentId, propertyId),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('listOperablePropertyIds excludes unassigned field agents', async () => {
    const gerantIds = await access.listOperablePropertyIds(gerantUserId);
    const assignedIds = await access.listOperablePropertyIds(assignedAgentId);
    const unassignedIds =
      await access.listOperablePropertyIds(unassignedAgentId);
    expect(gerantIds).toContain(propertyId);
    expect(assignedIds).toContain(propertyId);
    expect(unassignedIds).not.toContain(propertyId);
  });

  it('forbids a stranger', async () => {
    const stranger = await prisma.user.create({
      data: {
        phone: `+24208${String(Date.now()).slice(-7)}9`,
        countryId,
        name: 'Access Stranger',
      },
    });
    await expect(
      access.assertCanOperateOnProperty(stranger.id, propertyId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await prisma.user.delete({ where: { id: stranger.id } }).catch(() => undefined);
  });

  it('forbids field agent when assignment cleared', async () => {
    await prisma.mandate.update({
      where: { id: mandateId },
      data: { assignedAgentId: null },
    });
    await expect(
      access.assertCanOperateOnProperty(assignedAgentId, propertyId),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      access.assertCanOperateOnProperty(gerantUserId, propertyId),
    ).resolves.toBeUndefined();
    await prisma.mandate.update({
      where: { id: mandateId },
      data: { assignedAgentId },
    });
  });
});
