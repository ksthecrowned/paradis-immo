import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConversationContext } from '@prisma/client';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from './messaging.service';

describe('MessagingService context authorization', () => {
  it.each([
    {
      contextType: ConversationContext.LEASE,
      model: 'lease',
      row: {
        propertyId: 'property-1',
        tenantId: 'another-user',
        coTenants: [],
      },
    },
    {
      contextType: ConversationContext.BOOKING,
      model: 'booking',
      row: { propertyId: 'property-1', userId: 'another-user' },
    },
    {
      contextType: ConversationContext.VISIT,
      model: 'visitBooking',
      row: {
        propertyId: 'property-1',
        userId: 'another-user',
        slot: { propertyId: 'property-1' },
      },
    },
    {
      contextType: ConversationContext.MAINTENANCE,
      model: 'maintenanceTicket',
      row: { propertyId: 'property-1', reporterId: 'another-user' },
    },
    {
      contextType: ConversationContext.SALE,
      model: 'saleInquiry',
      row: { propertyId: 'property-1', userId: 'another-user' },
    },
  ])(
    'rejects opening a $contextType conversation for another user context',
    async ({ contextType, model, row }) => {
      const findUnique = jest.fn().mockResolvedValue(row);
      const conversationFindFirst = jest.fn();
      const conversationCreate = jest.fn();
      const prisma = {
        [model]: { findUnique },
        conversation: {
          findFirst: conversationFindFirst,
          create: conversationCreate,
        },
      } as unknown as PrismaService;
      const service = new MessagingService(
        prisma,
        {} as AgencyAccessService,
        { emit: jest.fn() } as unknown as EventPublisher,
      );

      await expect(
        service.openConversation('current-user', {
          contextType,
          contextId: 'context-1',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(conversationFindFirst).not.toHaveBeenCalled();
      expect(conversationCreate).not.toHaveBeenCalled();
    },
  );

  it('requires a context id except for support conversations', async () => {
    const prisma = {
      conversation: { findFirst: jest.fn(), create: jest.fn() },
    } as unknown as PrismaService;
    const service = new MessagingService(
      prisma,
      {} as AgencyAccessService,
      { emit: jest.fn() } as unknown as EventPublisher,
    );

    await expect(
      service.openConversation('current-user', {
        contextType: ConversationContext.SALE,
      }),
    ).rejects.toMatchObject({
      response: { code: 'CONTEXT_ID_REQUIRED' },
    });
    expect(prisma.conversation.findFirst).not.toHaveBeenCalled();
  });

  it('does not let organization role bypass property mandate access', async () => {
    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'conversation-1',
          clientUserId: 'another-user',
          propertyId: 'property-1',
          organizationId: 'owner-org',
        }),
      },
      message: { findMany: jest.fn() },
    } as unknown as PrismaService;
    const agencyAccess = {
      canOperateOnProperty: jest.fn().mockResolvedValue(false),
    };
    const service = new MessagingService(
      prisma,
      agencyAccess as unknown as AgencyAccessService,
      { emit: jest.fn() } as unknown as EventPublisher,
    );

    await expect(
      service.listMessages('removed-manager', 'conversation-1', {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(agencyAccess.canOperateOnProperty).toHaveBeenCalledWith(
      'removed-manager',
      'property-1',
    );
    expect(prisma.message.findMany).not.toHaveBeenCalled();
  });
});
