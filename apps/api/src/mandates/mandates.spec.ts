import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { MandatesService } from './mandates.service';
import { MandateApprovalService } from './mandate-approval.service';
import { AgencyAccessService } from './agency-access.service';

describe('Mandate delegation + owner approval', () => {
  let mandates: MandatesService;
  let approvals: MandateApprovalService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let agentUserId: string;
  let ownerOrgId: string;
  let agentOrgId: string;
  let propertyId: string;
  const createdMandateIds: string[] = [];
  const createdApprovalIds: string[] = [];
  const emittedEvents: Array<{ name: string; payload: unknown }> = [];

  beforeAll(async () => {
    const eventBus: Pick<EventPublisher, 'emit'> = {
      // eslint-disable-next-line @typescript-eslint/require-await
      emit: jest.fn(async (name, payload) => {
        emittedEvents.push({ name, payload });
        return { id: 'mock', name };
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        MandatesService,
        MandateApprovalService,
        AgencyAccessService,
        PrismaService,
        { provide: EventPublisher, useValue: eventBus },
      ],
    }).compile();
    mandates = moduleRef.get(MandatesService);
    approvals = moduleRef.get(MandateApprovalService);
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

    await prisma.user.deleteMany({
      where: { phone: { in: ['+242072200001', '+242072200002'] } },
    });
    const owner = await prisma.user.create({
      data: {
        phone: '+242072200001',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const agent = await prisma.user.create({
      data: {
        phone: '+242072200002',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    agentUserId = agent.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Mandate Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;
    const agentOrg = await prisma.organization.create({
      data: {
        name: `Mandate Test Agent ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: agentUserId, role: 'AGENT' } },
      },
    });
    agentOrgId = agentOrg.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Mandate Test Property',
        description: 'Pour tester les mandats',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    propertyId = prop.id;
  });

  afterAll(async () => {
    if (createdApprovalIds.length) {
      await prisma.mandateApproval
        .deleteMany({ where: { id: { in: createdApprovalIds } } })
        .catch(() => undefined);
    }
    if (createdMandateIds.length) {
      await prisma.mandate
        .deleteMany({ where: { id: { in: createdMandateIds } } })
        .catch(() => undefined);
    }
    await prisma.property
      .delete({ where: { id: propertyId } })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { organizationId: ownerOrgId },
    });
    await prisma.organizationMember.deleteMany({
      where: { organizationId: agentOrgId },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [ownerOrgId, agentOrgId] } },
    });
    await prisma.userRole.deleteMany({ where: { userId: ownerUserId } });
    await prisma.userRole.deleteMany({ where: { userId: agentUserId } });
    await prisma.user.deleteMany({ where: { id: ownerUserId } });
    await prisma.user.deleteMany({ where: { id: agentUserId } });
    await prisma.onModuleDestroy();
  });

  beforeEach(() => {
    emittedEvents.length = 0;
  });

  it('owner creates a mandate delegating the property to an agency', async () => {
    const m = await mandates.createMandate(ownerUserId, {
      propertyId,
      organizationId: agentOrgId,
    });
    createdMandateIds.push(m.id);

    expect(m.status).toBe('ACTIVE');
    expect(m.propertyId).toBe(propertyId);
    expect(m.organizationId).toBe(agentOrgId);
  });

  it('rejects mandate creation by non-owner', async () => {
    await expect(
      mandates.createMandate(agentUserId, {
        propertyId,
        organizationId: agentOrgId,
      }),
    ).rejects.toMatchObject({ response: { code: 'NOT_PROPERTY_OWNER' } });
  });

  it('requireApproval creates a PENDING approval and emits MANDATE_ACTION_PENDING', async () => {
    expect(createdMandateIds.length).toBeGreaterThan(0);
    const mandateId = createdMandateIds[0];

    const approval = await approvals.requireApproval({
      mandateId,
      actionType: 'LEASE_SIGN',
      payload: { tenantName: 'M. Test' },
      requestedByUserId: agentUserId,
    });
    createdApprovalIds.push(approval.id);

    expect(approval.status).toBe('PENDING');
    expect(
      emittedEvents.find((e) => e.name === 'mandate.action.pending'),
    ).toBeDefined();
  });

  it('owner approves a pending MandateApproval (LEASE_SIGN)', async () => {
    expect(createdApprovalIds.length).toBeGreaterThan(0);
    const approvalId = createdApprovalIds[0];

    const decided = await approvals.decideApproval(ownerUserId, approvalId, {
      approve: true,
    });
    expect(decided.status).toBe('APPROVED');
    expect(decided.decidedBy).toBe(ownerUserId);
  });

  it('non-owner cannot decide a MandateApproval', async () => {
    const fresh = await approvals.requireApproval({
      mandateId: createdMandateIds[0],
      actionType: 'MAJOR_REPAIR',
      payload: { amount: 500000 },
      requestedByUserId: agentUserId,
    });
    createdApprovalIds.push(fresh.id);

    await expect(
      approvals.decideApproval(agentUserId, fresh.id, { approve: true }),
    ).rejects.toMatchObject({ response: { code: 'NOT_PROPERTY_OWNER' } });
  });
});
