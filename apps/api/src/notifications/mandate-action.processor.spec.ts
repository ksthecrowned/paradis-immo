import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { MandateActionProcessor } from './processors/mandate-action.processor';

describe('MandateActionProcessor (spec 03 — MANDATE_ACTION_PENDING)', () => {
  let processor: MandateActionProcessor;
  let prisma: PrismaService;
  const send = jest.fn(async () => ({ status: 'SENT' as const }));
  let countryId: string;
  let ownerUserId: string;
  let orgId: string;
  let propertyId: string;
  let mandateId: string;
  let approvalId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        MandateActionProcessor,
        PrismaService,
        { provide: NotificationsService, useValue: { send } },
      ],
    }).compile();
    processor = moduleRef.get(MandateActionProcessor);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');

    await prisma.user.deleteMany({
      where: { phone: '+242072400001' },
    });
    const owner = await prisma.user.create({
      data: { phone: '+242072400001', countryId, name: 'Notify Owner' },
    });
    ownerUserId = owner.id;

    const org = await prisma.organization.create({
      data: {
        name: `Notify Owner Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Notify Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'x',
        countryId,
        ownerId: ownerUserId,
        organizationId: orgId,
      },
    });
    propertyId = prop.id;

    const mandate = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: orgId,
        status: 'ACTIVE',
        proposedById: ownerUserId,
      },
    });
    mandateId = mandate.id;

    const approval = await prisma.mandateApproval.create({
      data: {
        mandateId,
        actionType: 'MAJOR_REPAIR',
        payload: { ticketId: 't-1', estimatedCost: '250000' },
        status: 'PENDING',
        requestedById: ownerUserId,
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    approvalId = approval.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    if (approvalId) {
      await prisma.mandateApproval
        .deleteMany({ where: { id: approvalId } })
        .catch(() => undefined);
    }
    if (mandateId) {
      await prisma.mandate.deleteMany({ where: { id: mandateId } }).catch(() => undefined);
    }
    if (propertyId) {
      await prisma.property.deleteMany({ where: { id: propertyId } }).catch(() => undefined);
    }
    if (ownerUserId) {
      await prisma.organizationMember
        .deleteMany({ where: { userId: ownerUserId } })
        .catch(() => undefined);
      await prisma.userRole
        .deleteMany({ where: { userId: ownerUserId } })
        .catch(() => undefined);
      await prisma.user.deleteMany({ where: { id: ownerUserId } }).catch(() => undefined);
    }
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } }).catch(() => undefined);
    }
    await prisma.onModuleDestroy();
  });

  beforeEach(() => {
    send.mockClear();
  });

  it('notifies the property owner of a pending approval', async () => {
    const result = await processor.handlePending(
      approvalId,
      mandateId,
      'MAJOR_REPAIR',
    );
    expect(result.sent).toBe(true);
    expect(send).toHaveBeenCalledWith({
      userId: ownerUserId,
      type: 'MANDATE_ACTION_PENDING',
      payload: { approvalId, mandateId, actionType: 'MAJOR_REPAIR' },
    });
  });

  it('handles the domain event and tolerates unknown mandates', async () => {
    await processor.handle({
      name: 'mandate.action.pending',
      payload: { approvalId, mandateId, actionType: 'MAJOR_REPAIR' },
      emittedAt: new Date().toISOString(),
    });
    expect(send).toHaveBeenCalledTimes(1);

    send.mockClear();
    const missing = await processor.handlePending(
      approvalId,
      'mandate-does-not-exist',
      'MAJOR_REPAIR',
    );
    expect(missing).toEqual({ sent: false, reason: 'MANDATE_NOT_FOUND' });
    expect(send).not.toHaveBeenCalled();
  });
});
