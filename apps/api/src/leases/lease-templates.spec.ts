import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { LeaseTemplatesService } from './lease-templates.service';

/** Spec 04 P2 — modèles de bail. */
describe('LeaseTemplatesService — modèles de bail (spec 04 P2)', () => {
  let service: LeaseTemplatesService;
  let prisma: PrismaService;
  let countryId: string;
  let agenceUserId: string;
  let agentUserId: string;
  let ownerUserId: string;
  let organizationId: string;
  let contratsId: string;

  const phones = ['+242070000101', '+242070000102', '+242070000103'];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [LeaseTemplatesService, PrismaService, AgencyAccessService],
    }).compile();
    service = moduleRef.get(LeaseTemplatesService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;

    // Leftovers from previous runs: their orgs (with members and templates)
    // block the (phone, countryId) unique constraint on User.
    await prisma.organizationMember.deleteMany({
      where: { organization: { name: { startsWith: 'Templates Org' } } },
    });
    await prisma.leaseTemplate.deleteMany({
      where: { organization: { name: { startsWith: 'Templates Org' } } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: 'Templates Org' } },
    });
    await prisma.organizationMember.deleteMany({
      where: { organization: { name: { startsWith: 'Other Org' } } },
    });
    await prisma.organization.deleteMany({
      where: { name: { startsWith: 'Other Org' } },
    });

    const stale = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.refreshToken.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const [agent, agence, owner] = await Promise.all([
      prisma.user.create({
        data: {
          phone: phones[0],
          countryId,
          name: 'Agent de l agence',
          roles: { create: { role: 'TENANT' } },
        },
      }),
      prisma.user.create({
        data: {
          phone: phones[1],
          countryId,
          name: 'Gérant de l agence',
          roles: { create: { role: 'TENANT' } },
        },
      }),
      prisma.user.create({
        data: {
          phone: phones[2],
          countryId,
          name: 'Propriétaire',
          roles: { create: { role: 'TENANT' } },
        },
      }),
    ]);
    agentUserId = agent.id;
    agenceUserId = agence.id;
    ownerUserId = owner.id;

    const agencyOrg = await prisma.organization.create({
      data: {
        name: `Templates Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: {
          create: [
            { userId: agenceUserId, role: 'ADMIN' },
            { userId: agentUserId, role: 'AGENT' },
          ],
        },
      },
    });
    organizationId = agencyOrg.id;

    contratsId = (
      await prisma.leaseTemplate.create({
        data: {
          organizationId,
          name: 'Contrat standard',
          body: 'Loyer {{loyer}}',
          isDefault: true,
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.leaseTemplate.deleteMany({ where: { organizationId } });
    await prisma.organizationMember.deleteMany({ where: { organizationId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [agenceUserId, agentUserId, ownerUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [agenceUserId, agentUserId, ownerUserId] } },
    });
    await prisma.onModuleDestroy();
  });

  const input = {
    name: 'Contrat révisé',
    body: 'Loyer {{loyer}} · durée 3 ans',
    isDefault: false,
  };

  it('the gérant lists its templates', async () => {
    const rows = await service.list(agenceUserId, organizationId);
    expect(rows).toContainEqual(
      expect.objectContaining({ id: contratsId, name: 'Contrat standard' }),
    );
  });

  it('an agent is denied', async () => {
    await expect(service.list(agentUserId, organizationId)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('the gérant creates a template', async () => {
    const created = await service.create(agenceUserId, organizationId, input);
    expect(created.name).toBe(input.name);
    expect(created.body).toBe(input.body);
    expect(created.isDefault).toBe(false);
  });

  it('only one template can be default', async () => {
    const created = await service.create(agenceUserId, organizationId, {
      ...input,
      name: 'Autre',
      isDefault: true,
    });
    expect(created.isDefault).toBe(true);
    const rows = await service.list(agenceUserId, organizationId);
    const defaultRows = rows.filter((r) => r.isDefault);
    expect(defaultRows).toHaveLength(1);
    expect(defaultRows[0].id).toBe(created.id);
  });

  it('a duplicate name is rejected', async () => {
    await expect(
      service.create(agenceUserId, organizationId, { ...input, name: 'Contrat standard' }),
    ).rejects.toMatchObject({ response: { code: 'LEASE_TEMPLATE_NAME_TAKEN' } });
  });

  it('the gérant updates a template', async () => {
    const updated = await service.update(agenceUserId, organizationId, contratsId, {
      name: 'Contrat standard 2',
    });
    expect(updated.name).toBe('Contrat standard 2');
  });

  it('an outsider cannot read templates', async () => {
    await expect(service.list(ownerUserId, organizationId)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('a template of another organization is hidden', async () => {
    const otherOrg = (
      await prisma.organization.create({
        data: {
          name: `Other Org ${Date.now()}`,
          type: 'AGENCY',
          countryId,
          members: { create: { userId: ownerUserId, role: 'ADMIN' } },
        },
      })
    ).id;
    try {
      const rows = await service.list(ownerUserId, otherOrg);
      expect(rows).toHaveLength(0);
    } finally {
      await prisma.organizationMember.deleteMany({ where: { organizationId: otherOrg } });
      await prisma.organization.deleteMany({ where: { id: otherOrg } });
    }
  });

  it('a missing template is not found', async () => {
    await expect(
      service.update(agenceUserId, organizationId, '00000000-0000-0000-0000-000000000000', input),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('the gérant deletes a template', async () => {
    await expect(
      service.remove(agenceUserId, organizationId, contratsId),
    ).resolves.toBeUndefined();
    const rows = await service.list(agenceUserId, organizationId);
    expect(rows.map((r) => r.id)).not.toContain(contratsId);
  });
});
