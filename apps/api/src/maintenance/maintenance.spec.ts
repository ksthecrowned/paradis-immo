import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import { MandatesService } from '../mandates/mandates.service';
import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  let maintenance: MaintenanceService;
  let approvals: MandateApprovalService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let agentUserId: string;
  let ownerOrgId: string;
  let agentOrgId: string;
  let mandateId: string;
  let rentPropertyId: string;
  const createdTicketIds: string[] = [];
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
        MaintenanceService,
        MandateApprovalService,
        MandatesService,
        PrismaService,
        { provide: EventPublisher, useValue: eventBus },
      ],
    }).compile();
    maintenance = moduleRef.get(MaintenanceService);
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

    // Belt-and-suspenders cleanup
    const userIds = (
      await prisma.user.findMany({
        where: {
          phone: {
            in: ['+242074444441', '+242074444442', '+242074444443'],
          },
        },
        select: { id: true },
      })
    ).map((u) => u.id);
    if (userIds.length > 0) {
      await prisma.mandateApproval
        .deleteMany({
          where: { mandate: { property: { ownerId: { in: userIds } } } },
        })
        .catch(() => undefined);
      await prisma.maintenanceTicket
        .deleteMany({ where: { reporterId: { in: userIds } } })
        .catch(() => undefined);
      await prisma.mandate
        .deleteMany({ where: { property: { ownerId: { in: userIds } } } })
        .catch(() => undefined);
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: userIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    }
    const owner = await prisma.user.create({
      data: {
        phone: '+242074444441',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const tenant = await prisma.user.create({
      data: {
        phone: '+242074444442',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;
    const agent = await prisma.user.create({
      data: {
        phone: '+242074444443',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    agentUserId = agent.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Maintenance Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;
    const agentOrg = await prisma.organization.create({
      data: {
        name: `Maintenance Test Agent ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: agentUserId, role: 'AGENT' } },
      },
    });
    agentOrgId = agentOrg.id;
    const prop = await prisma.property.create({
      data: {
        title: 'Maintenance Test Property',
        description: 'Pour tester les tickets de maintenance',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 200_000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    rentPropertyId = prop.id;
    const mandate = await prisma.mandate.create({
      data: {
        propertyId: rentPropertyId,
        organizationId: agentOrg.id,
        status: 'ACTIVE',
        startDate: new Date(),
      },
    });
    mandateId = mandate.id;
  });

  afterAll(async () => {
    if (createdTicketIds.length) {
      await prisma.maintenanceTicket
        .deleteMany({ where: { id: { in: createdTicketIds } } })
        .catch(() => undefined);
    }
    if (createdApprovalIds.length) {
      await prisma.mandateApproval
        .deleteMany({ where: { id: { in: createdApprovalIds } } })
        .catch(() => undefined);
    }
    if (rentPropertyId) {
      await prisma.maintenanceTicket
        .deleteMany({ where: { propertyId: rentPropertyId } })
        .catch(() => undefined);
      await prisma.mandateApproval
        .deleteMany({ where: { mandateId } })
        .catch(() => undefined);
      await prisma.mandate
        .deleteMany({ where: { id: mandateId } })
        .catch(() => undefined);
      await prisma.property
        .delete({ where: { id: rentPropertyId } })
        .catch(() => undefined);
    }
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, agentUserId] } },
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [ownerOrgId, agentOrgId] } },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, agentUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, tenantUserId, agentUserId] } },
    });
    await prisma.onModuleDestroy();
  });

  it('creates a ticket and rejects unknown properties', async () => {
    await expect(
      maintenance.createTicket({
        propertyId: '00000000-0000-0000-0000-000000000000',
        reporterId: tenantUserId,
        title: 'Fuite',
        description: "Sous l'évier",
        priority: MaintenancePriority.HIGH,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a LOW ticket without owner approval', async () => {
    emittedEvents.length = 0;
    const t = await maintenance.createTicket({
      propertyId: rentPropertyId,
      reporterId: tenantUserId,
      title: 'Ampoule grillée',
      description: 'Salon',
      priority: MaintenancePriority.LOW,
    });
    createdTicketIds.push(t.id);

    expect(t.priority).toBe(MaintenancePriority.LOW);
    expect(t.status).toBe(MaintenanceStatus.OPEN);
    expect(t.requiresOwnerApproval).toBe(false);
    expect(t.estimatedCost).toBeNull();

    // MAINTENANCE_OPENED emitted exactly once
    const opened = emittedEvents.filter((e) => e.name === 'maintenance.opened');
    expect(opened).toHaveLength(1);
    expect((opened[0].payload as { ticketId: string }).ticketId).toBe(t.id);
    expect((opened[0].payload as { propertyId: string }).propertyId).toBe(
      rentPropertyId,
    );
    expect((opened[0].payload as { priority: string }).priority).toBe('LOW');
  });

  it('URGENT ticket with estimatedCost above threshold requires owner approval', async () => {
    emittedEvents.length = 0;
    const t = await maintenance.createTicket({
      propertyId: rentPropertyId,
      reporterId: tenantUserId,
      title: 'Fuite importante',
      description: 'Toiture',
      priority: MaintenancePriority.URGENT,
      estimatedCost: 250_000,
      // The mandate is the one granted to the agent org for this property.
      mandateId,
    });
    createdTicketIds.push(t.id);

    expect(t.requiresOwnerApproval).toBe(true);
    expect(t.estimatedCost).toBe('250000');
    expect(t.priority).toBe(MaintenancePriority.URGENT);

    // A pending MandateApproval should now exist for MAJOR_REPAIR
    const pending = await approvals.listForMandate(mandateId);
    const ours = pending.filter((a) => a.actionType === 'MAJOR_REPAIR');
    expect(ours.length).toBeGreaterThanOrEqual(1);
    const tracked = ours.find((a) => a.id);
    expect(tracked).toBeDefined();
    if (tracked) createdApprovalIds.push(tracked.id);
    const latest = ours[0];
    expect(latest.payload).toMatchObject({
      ticketId: t.id,
      estimatedCost: '250000',
    });
  });

  it('URGENT ticket below threshold does not require owner approval', async () => {
    emittedEvents.length = 0;
    const t = await maintenance.createTicket({
      propertyId: rentPropertyId,
      reporterId: tenantUserId,
      title: 'Petite fuite',
      description: 'Robinet',
      priority: MaintenancePriority.URGENT,
      estimatedCost: 50_000,
    });
    createdTicketIds.push(t.id);

    expect(t.requiresOwnerApproval).toBe(false);
    expect(t.estimatedCost).toBe('50000');
  });

  it('assigns a ticket to a user', async () => {
    // Create a fresh OPEN ticket
    const t = await maintenance.createTicket({
      propertyId: rentPropertyId,
      reporterId: tenantUserId,
      title: 'À assigner',
      description: 'Test assign',
      priority: MaintenancePriority.MEDIUM,
    });
    createdTicketIds.push(t.id);

    const assigned = await maintenance.assignTicket(t.id, agentUserId);
    expect(assigned.status).toBe(MaintenanceStatus.ASSIGNED);
    expect(assigned.assigneeId).toBe(agentUserId);
  });

  it('listForActor returns tickets on properties the actor owns', async () => {
    // Create a fresh ticket on the owner-managed property
    const t = await maintenance.createTicket({
      propertyId: rentPropertyId,
      reporterId: tenantUserId,
      title: 'Vue owner',
      description: 'Ticket vu par le owner',
      priority: MaintenancePriority.MEDIUM,
    });
    createdTicketIds.push(t.id);

    const tickets = await maintenance.listForActor(ownerUserId);
    const ids = tickets.map((x) => x.id);
    expect(ids).toContain(t.id);

    // Shape check
    const sample = tickets[0];
    expect(sample).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        propertyId: expect.any(String),
        reporterId: expect.any(String),
        title: expect.any(String),
        description: expect.any(String),
        priority: expect.any(String),
        status: expect.any(String),
        requiresOwnerApproval: expect.any(Boolean),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      }),
    );
  });

  it('listForActor returns tickets on properties the agent org manages', async () => {
    // The agent is a member of agentOrgId, but the property is owned by
    // ownerOrgId. listForActor filters by property.organization.members,
    // so we add the agent to the owner org to exercise that branch.
    await prisma.organizationMember.create({
      data: {
        organizationId: ownerOrgId,
        userId: agentUserId,
        role: 'AGENT',
      },
    });

    const t = await maintenance.createTicket({
      propertyId: rentPropertyId,
      reporterId: tenantUserId,
      title: 'Vue agent',
      description: 'Ticket vu par le agent',
      priority: MaintenancePriority.LOW,
    });
    createdTicketIds.push(t.id);

    const tickets = await maintenance.listForActor(agentUserId);
    const ids = tickets.map((x) => x.id);
    expect(ids).toContain(t.id);
  });

  it('listForActor returns [] for an unrelated user', async () => {
    const tickets = await maintenance.listForActor(tenantUserId);
    expect(tickets).toEqual([]);
  });
});
