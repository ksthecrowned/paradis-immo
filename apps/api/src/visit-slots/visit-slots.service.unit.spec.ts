import { BadRequestException, ConflictException } from '@nestjs/common';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { VisitSlotsService } from './visit-slots.service';

describe('VisitSlotsService atomic booking', () => {
  it('allows only one concurrent paid hold for an available slot', async () => {
    let slotStatus = 'AVAILABLE';
    let bookingCount = 0;
    let nextBookingId = 0;
    const tx = {
      visitSlot: {
        updateMany: jest.fn(async ({ where, data }) => {
          if (
            where.id !== 'slot-1' ||
            where.propertyId !== 'property-1' ||
            where.status !== slotStatus
          ) {
            return { count: 0 };
          }
          slotStatus = data.status;
          return { count: 1 };
        }),
      },
      visitBooking: {
        create: jest.fn(async ({ data }) => {
          bookingCount++;
          return {
            id: `booking-${++nextBookingId}`,
            ...data,
            createdAt: new Date('2026-10-11T12:00:00Z'),
          };
        }),
      },
    };
    const prisma = {
      property: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'property-1',
          visitType: 'PAID',
          visitEnabled: true,
          visitPrice: 5000,
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;
    const events = { emit: jest.fn().mockResolvedValue(undefined) };
    const service = new VisitSlotsService(
      prisma,
      events as unknown as EventPublisher,
      {} as AgencyAccessService,
      {} as UsersService,
    );

    const results = await Promise.allSettled([
      service.bookVisit('user-1', {
        slotId: 'slot-1',
        propertyId: 'property-1',
      }),
      service.bookVisit('user-2', {
        slotId: 'slot-1',
        propertyId: 'property-1',
      }),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    expect(rejected?.reason).toBeInstanceOf(ConflictException);
    expect(bookingCount).toBe(1);
    expect(slotStatus).toBe('HELD');
    expect(events.emit).toHaveBeenCalledTimes(1);
  });

  it('closes a started confirmed visit once and emits its outcome', async () => {
    const booking = {
      id: 'booking-1',
      slotId: 'slot-1',
      propertyId: 'property-1',
      userId: 'user-1',
      status: 'CONFIRMED',
      paymentId: null,
      holdExpiresAt: null,
      priceAmount: null,
      currency: null,
      createdAt: new Date('2026-10-10T12:00:00Z'),
      slot: { startAt: new Date('2026-10-10T12:00:00Z') },
    };
    const updatedBooking = {
      ...booking,
      status: 'COMPLETED',
      completedAt: new Date(),
    };
    const tx = {
      visitBooking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(updatedBooking),
      },
    };
    const prisma = {
      visitBooking: {
        findUnique: jest.fn().mockResolvedValue(booking),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;
    const agencyAccess = {
      assertCanOperateOnProperty: jest.fn().mockResolvedValue(undefined),
    };
    const events = { emit: jest.fn().mockResolvedValue(undefined) };
    const service = new VisitSlotsService(
      prisma,
      events as unknown as EventPublisher,
      agencyAccess as unknown as AgencyAccessService,
      {} as UsersService,
    );

    const result = await service.completeVisit('manager-1', 'booking-1');

    expect(result.status).toBe('COMPLETED');
    expect(tx.visitBooking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking-1', status: 'CONFIRMED' },
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'visit_booking.completed',
      expect.objectContaining({ bookingId: 'booking-1' }),
    );
  });

  it('rejects closing a visit before its scheduled start', async () => {
    const prisma = {
      visitBooking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          propertyId: 'property-1',
          status: 'CONFIRMED',
          slot: { startAt: new Date(Date.now() + 60 * 60 * 1000) },
        }),
      },
    } as unknown as PrismaService;
    const agencyAccess = {
      assertCanOperateOnProperty: jest.fn().mockResolvedValue(undefined),
    };
    const service = new VisitSlotsService(
      prisma,
      { emit: jest.fn() } as unknown as EventPublisher,
      agencyAccess as unknown as AgencyAccessService,
      {} as UsersService,
    );

    await expect(
      service.markVisitNoShow('manager-1', 'booking-1'),
    ).rejects.toMatchObject({
      response: { code: 'VISIT_NOT_STARTED' },
    });
  });

  it('allows the active booking-assigned agency agent to close the visit', async () => {
    const booking = {
      id: 'booking-1',
      slotId: 'slot-1',
      propertyId: 'property-1',
      userId: 'user-1',
      agentId: 'agent-1',
      agentOrganizationId: 'agency-1',
      status: 'CONFIRMED',
      paymentId: null,
      holdExpiresAt: null,
      priceAmount: null,
      currency: null,
      createdAt: new Date('2026-10-10T12:00:00Z'),
      slot: { startAt: new Date('2026-10-10T12:00:00Z') },
    };
    const tx = {
      visitBooking: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...booking,
          status: 'COMPLETED',
        }),
      },
    };
    const prisma = {
      visitBooking: {
        findUnique: jest.fn().mockResolvedValue(booking),
      },
      property: {
        findUnique: jest.fn().mockResolvedValue({
          organizationId: 'owner-org-1',
        }),
      },
      mandate: {
        findFirst: jest.fn().mockResolvedValue({ id: 'mandate-1' }),
      },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({
          role: 'AGENT',
          status: 'ACTIVE',
        }),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    } as unknown as PrismaService;
    const agencyAccess = {
      assertCanOperateOnProperty: jest.fn(),
    };
    const events = { emit: jest.fn().mockResolvedValue(undefined) };
    const service = new VisitSlotsService(
      prisma,
      events as unknown as EventPublisher,
      agencyAccess as unknown as AgencyAccessService,
      {} as UsersService,
    );

    const result = await service.completeVisit('agent-1', 'booking-1');

    expect(result.status).toBe('COMPLETED');
    expect(agencyAccess.assertCanOperateOnProperty).not.toHaveBeenCalled();
    expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: 'agent-1',
          organizationId: 'agency-1',
        },
      },
      select: { role: true, status: true },
    });
  });

  it('marks confirmed visits older than 24 hours once and emits follow-up', async () => {
    const changed = new Set<string>();
    const prisma = {
      visitBooking: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'booking-1' }, { id: 'booking-2' }]),
        updateMany: jest.fn(async ({ where }) => {
          if (changed.has(where.id)) return { count: 0 };
          changed.add(where.id);
          return { count: 1 };
        }),
        findUniqueOrThrow: jest.fn(async ({ where }) => ({
          id: where.id,
          slotId: `slot-${where.id}`,
          userId: `visitor-${where.id}`,
          propertyId: `property-${where.id}`,
        })),
      },
    } as unknown as PrismaService;
    const events = { emit: jest.fn().mockResolvedValue(undefined) };
    const service = new VisitSlotsService(
      prisma,
      events as unknown as EventPublisher,
      {} as AgencyAccessService,
      {} as UsersService,
    );
    const now = new Date('2026-10-11T12:00:00Z');

    expect(await service.markUnconfirmedVisits(now)).toBe(2);
    expect(prisma.visitBooking.findMany).toHaveBeenCalledWith({
      where: {
        status: 'CONFIRMED',
        slot: { startAt: { lte: new Date('2026-10-10T12:00:00.000Z') } },
      },
      select: { id: true },
    });
    expect(events.emit).toHaveBeenCalledTimes(2);
    expect(events.emit).toHaveBeenCalledWith(
      'visit_booking.completed_unconfirmed',
      expect.objectContaining({ bookingId: 'booking-1' }),
    );
    expect(await service.markUnconfirmedVisits(now)).toBe(0);
    expect(events.emit).toHaveBeenCalledTimes(2);
  });

  it('saves a report only for a completed visit and requires a follow-up date', async () => {
    const prisma = {
      visitBooking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          propertyId: 'property-1',
          status: 'COMPLETED',
        }),
      },
      visitReport: { upsert: jest.fn() },
    } as unknown as PrismaService;
    const agencyAccess = {
      assertCanOperateOnProperty: jest.fn().mockResolvedValue(undefined),
    };
    const service = new VisitSlotsService(
      prisma,
      { emit: jest.fn() } as unknown as EventPublisher,
      agencyAccess as unknown as AgencyAccessService,
      {} as UsersService,
    );

    await expect(
      service.saveVisitReport('manager-1', 'booking-1', {
        interestLevel: 4,
        nextStep: 'FOLLOW_UP',
      }),
    ).rejects.toMatchObject({
      response: { code: 'FOLLOW_UP_DATE_REQUIRED' },
    });
    expect(prisma.visitReport.upsert).not.toHaveBeenCalled();
  });

  it('upserts a report for a completed visit with validated manager access', async () => {
    const report = {
      id: 'report-1',
      visitBookingId: 'booking-1',
      authorId: 'manager-1',
      interestLevel: 4,
      notes: 'Le chercheur souhaite déposer un dossier.',
      nextStep: 'FOLLOW_UP',
      followUpAt: new Date('2026-10-13T12:00:00Z'),
      createdAt: new Date('2026-10-11T12:00:00Z'),
      updatedAt: new Date('2026-10-11T12:00:00Z'),
    };
    const prisma = {
      visitBooking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          propertyId: 'property-1',
          status: 'COMPLETED',
        }),
      },
      visitReport: { upsert: jest.fn().mockResolvedValue(report) },
    } as unknown as PrismaService;
    const agencyAccess = {
      assertCanOperateOnProperty: jest.fn().mockResolvedValue(undefined),
    };
    const service = new VisitSlotsService(
      prisma,
      { emit: jest.fn() } as unknown as EventPublisher,
      agencyAccess as unknown as AgencyAccessService,
      {} as UsersService,
    );

    const result = await service.saveVisitReport('manager-1', 'booking-1', {
      interestLevel: 4,
      notes: 'Le chercheur souhaite déposer un dossier.',
      nextStep: 'FOLLOW_UP',
      followUpAt: '2026-10-13T12:00:00Z',
    });

    expect(agencyAccess.assertCanOperateOnProperty).toHaveBeenCalledWith(
      'manager-1',
      'property-1',
    );
    expect(prisma.visitReport.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { visitBookingId: 'booking-1' },
        create: expect.objectContaining({
          visitBookingId: 'booking-1',
          authorId: 'manager-1',
          interestLevel: 4,
        }),
      }),
    );
    expect(result).toEqual(report);
  });

  it('sends J-1 and H-2 reminders once per confirmed booking', async () => {
    const markedIds = new Set<string>();
    const prisma = {
      visitBooking: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'booking-j1',
            slotId: 'slot-j1',
            userId: 'visitor-j1',
            slot: { startAt: new Date('2026-10-12T11:00:00Z') },
          },
          {
            id: 'booking-h2',
            slotId: 'slot-h2',
            userId: 'visitor-h2',
            slot: { startAt: new Date('2026-10-11T13:00:00Z') },
          },
        ]),
        updateMany: jest.fn(async ({ where }) => {
          if (markedIds.has(where.id)) return { count: 0 };
          markedIds.add(where.id);
          return { count: 1 };
        }),
      },
    } as unknown as PrismaService;
    const events = { emit: jest.fn().mockResolvedValue(undefined) };
    const service = new VisitSlotsService(
      prisma,
      events as unknown as EventPublisher,
      {} as AgencyAccessService,
      {} as UsersService,
    );

    expect(
      await service.sendVisitReminders(new Date('2026-10-11T12:00:00Z')),
    ).toBe(2);
    expect(events.emit).toHaveBeenCalledWith(
      'visit.reminder',
      expect.objectContaining({ bookingId: 'booking-j1', kind: 'J1' }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'visit.reminder',
      expect.objectContaining({ bookingId: 'booking-h2', kind: 'H2' }),
    );
    expect(
      await service.sendVisitReminders(new Date('2026-10-11T12:00:00Z')),
    ).toBe(0);
  });

  it('assigns an active agency agent to a managed visit and notifies them', async () => {
    const booking = {
      id: 'booking-1',
      propertyId: 'property-1',
      agentId: null,
      status: 'CONFIRMED',
      slotId: 'slot-1',
      userId: 'visitor-1',
      paymentId: null,
      holdExpiresAt: null,
      priceAmount: null,
      currency: null,
      createdAt: new Date('2026-10-11T12:00:00Z'),
    };
    const assigned = { ...booking, agentId: 'agent-1' };
    const prisma = {
      visitBooking: {
        findUnique: jest.fn().mockResolvedValue(booking),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          ...assigned,
          agentOrganizationId: 'agency-1',
        }),
      },
      property: {
        findUnique: jest.fn().mockResolvedValue({
          ownerId: 'owner-1',
          organizationId: 'owner-org-1',
        }),
      },
      mandate: {
        findFirst: jest.fn().mockResolvedValue({
          organizationId: 'agency-1',
        }),
      },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({
          role: 'AGENT',
          status: 'ACTIVE',
        }),
      },
    } as unknown as PrismaService;
    const events = { emit: jest.fn().mockResolvedValue(undefined) };
    const service = new VisitSlotsService(
      prisma,
      events as unknown as EventPublisher,
      {} as AgencyAccessService,
      {} as UsersService,
    );

    const result = await service.assignVisitAgent(
      'owner-1',
      'booking-1',
      'agent-1',
    );

    expect(result.agentId).toBe('agent-1');
    expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith({
      where: {
        userId_organizationId: {
          userId: 'agent-1',
          organizationId: 'agency-1',
        },
      },
      select: { role: true, status: true },
    });
    expect(prisma.visitBooking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
      data: {
        agentId: 'agent-1',
        agentOrganizationId: 'agency-1',
      },
    });
    expect(events.emit).toHaveBeenCalledWith(
      'visit.agent.assigned',
      expect.objectContaining({
        bookingId: 'booking-1',
        agentId: 'agent-1',
      }),
    );
  });

  it('rejects assigning a user who is not an active agency agent', async () => {
    const prisma = {
      visitBooking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          propertyId: 'property-1',
          agentId: null,
          status: 'CONFIRMED',
        }),
        updateMany: jest.fn(),
      },
      property: {
        findUnique: jest.fn().mockResolvedValue({
          ownerId: 'owner-1',
          organizationId: 'owner-org-1',
        }),
      },
      mandate: {
        findFirst: jest.fn().mockResolvedValue({
          organizationId: 'agency-1',
        }),
      },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({
          role: 'AGENT',
          status: 'DISABLED',
        }),
      },
    } as unknown as PrismaService;
    const service = new VisitSlotsService(
      prisma,
      { emit: jest.fn() } as unknown as EventPublisher,
      {} as AgencyAccessService,
      {} as UsersService,
    );

    await expect(
      service.assignVisitAgent('owner-1', 'booking-1', 'agent-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.visitBooking.updateMany).not.toHaveBeenCalled();
  });

  it('rejects agent members from assigning visits', async () => {
    const prisma = {
      visitBooking: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'booking-1',
          propertyId: 'property-1',
          agentId: null,
          status: 'CONFIRMED',
        }),
        updateMany: jest.fn(),
      },
      property: {
        findUnique: jest.fn().mockResolvedValue({
          ownerId: 'owner-1',
          organizationId: 'agency-1',
        }),
      },
      mandate: {
        findFirst: jest.fn().mockResolvedValue({
          organizationId: 'agency-1',
        }),
      },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({
          role: 'AGENT',
          status: 'ACTIVE',
        }),
      },
    } as unknown as PrismaService;
    const service = new VisitSlotsService(
      prisma,
      { emit: jest.fn() } as unknown as EventPublisher,
      {} as AgencyAccessService,
      {} as UsersService,
    );

    await expect(
      service.assignVisitAgent('agent-1', 'booking-1', null),
    ).rejects.toMatchObject({
      response: { code: 'NOT_VISIT_MANAGER' },
    });
    expect(prisma.visitBooking.updateMany).not.toHaveBeenCalled();
  });

  it('lists assigned visits only while the assigned agency mandate is active', async () => {
    const slot = {
      startAt: new Date('2026-10-12T12:00:00Z'),
      endAt: new Date('2026-10-12T13:00:00Z'),
    };
    const bookings = [
      {
        id: 'active-booking',
        slotId: 'active-slot',
        propertyId: 'mandated-property',
        userId: 'visitor-1',
        agentId: 'agent-1',
        agentOrganizationId: 'agency-1',
        status: 'CONFIRMED',
        paymentId: null,
        holdExpiresAt: null,
        priceAmount: null,
        currency: null,
        createdAt: new Date('2026-10-11T12:00:00Z'),
        slot,
        property: { organizationId: 'owner-org' },
      },
      {
        id: 'ended-booking',
        slotId: 'ended-slot',
        propertyId: 'ended-property',
        userId: 'visitor-2',
        agentId: 'agent-1',
        agentOrganizationId: 'agency-1',
        status: 'CONFIRMED',
        paymentId: null,
        holdExpiresAt: null,
        priceAmount: null,
        currency: null,
        createdAt: new Date('2026-10-11T12:00:00Z'),
        slot,
        property: { organizationId: 'another-owner-org' },
      },
    ];
    const prisma = {
      organizationMember: {
        findMany: jest.fn().mockResolvedValue([{ organizationId: 'agency-1' }]),
      },
      mandate: {
        findMany: jest.fn().mockResolvedValue([
          { propertyId: 'mandated-property', organizationId: 'agency-1' },
        ]),
      },
      visitBooking: {
        findMany: jest.fn().mockResolvedValue(bookings),
      },
    } as unknown as PrismaService;
    const agencyAccess = {
      listOperablePropertyIds: jest.fn().mockResolvedValue([]),
    };
    const service = new VisitSlotsService(
      prisma,
      { emit: jest.fn() } as unknown as EventPublisher,
      agencyAccess as unknown as AgencyAccessService,
      {} as UsersService,
    );

    const result = await service.listManagedBookings('agent-1');

    expect(result.map((booking) => booking.id)).toEqual(['active-booking']);
    expect(result[0].agentId).toBe('agent-1');
  });
});
