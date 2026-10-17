import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';
import type { DomainEvent } from '../../events/event.types';
import { PaymentOutcomeProcessor } from './payment-outcome.processor';

function makeProcessor(
  prisma: Record<string, unknown>,
  send: jest.Mock,
): PaymentOutcomeProcessor {
  return new PaymentOutcomeProcessor(
    prisma as unknown as PrismaService,
    { send } as unknown as NotificationsService,
  );
}

describe('PaymentOutcomeProcessor — litige et remboursement (spec 11)', () => {
  let send: jest.Mock;

  beforeEach(() => {
    send = jest.fn(async () => ({ status: 'SENT' as const }));
  });

  it('REFUND_DONE est notifié au payeur du paiement', async () => {
    const prisma = {
      payment: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ userId: 'payer-1' }),
      },
    };
    const processor = makeProcessor(prisma, send);
    const event = {
      payload: {
        paymentId: 'pay-1',
        refundId: 'refund-1',
        amount: '50000',
        currency: 'XAF',
      },
    } as unknown as DomainEvent<Record<string, unknown>>;

    await processor.handleRefunded(event);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      userId: 'payer-1',
      type: 'REFUND_DONE',
      payload: {
        paymentId: 'pay-1',
        refundId: 'refund-1',
        amount: '50000',
        currency: 'XAF',
      },
    });
  });

  it('REFUND_DONE sans paiement : aucune notification', async () => {
    const prisma = {
      payment: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const processor = makeProcessor(prisma, send);
    const event = {
      payload: { paymentId: 'ghost', amount: '1', currency: 'XAF' },
    } as unknown as DomainEvent<Record<string, unknown>>;

    await expect(
      processor.handleRefunded(event),
    ).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });

  it('DISPUTE_OPENED est notifié aux gérants de l\'org du bien réservé', async () => {
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          bookingId: 'booking-1',
          allocations: [],
        }),
      },
      booking: {
        findUnique: jest.fn().mockResolvedValue({
          property: { organizationId: 'org-1' },
        }),
      },
      organizationMember: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ userId: 'gerant-1' }, { userId: 'admin-2' }]),
      },
    };
    const processor = makeProcessor(prisma, send);
    const event = {
      payload: {
        paymentId: 'pay-1',
        disputeId: 'dispute-1',
        openedBy: 'payer-1',
        reason: 'double prélèvement',
      },
    } as unknown as DomainEvent<Record<string, unknown>>;

    await processor.handleDisputed(event);

    expect(send).toHaveBeenCalledTimes(2);
    for (const call of send.mock.calls) {
      expect(call[0].type).toBe('DISPUTE_OPENED');
      expect(call[0].payload).toMatchObject({
        disputeId: 'dispute-1',
        reason: 'double prélèvement',
      });
    }
  });

  it('DISPUTE_OPENED sur un paiement loyer passe par les allocations', async () => {
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          bookingId: null,
          allocations: [
            {
              rentSchedule: {
                lease: {
                  property: { organizationId: 'org-rent' },
                },
              },
            },
          ],
        }),
      },
      organizationMember: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'gerant-3' }]),
      },
    };
    const processor = makeProcessor(prisma, send);
    const event = {
      payload: {
        paymentId: 'pay-2',
        disputeId: 'dispute-2',
        openedBy: 'payer-2',
        reason: null,
      },
    } as unknown as DomainEvent<Record<string, unknown>>;

    await processor.handleDisputed(event);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      userId: 'gerant-3',
      type: 'DISPUTE_OPENED',
    });
  });

  it('DISPUTE_OPENED sans org résoluble : envoi évité (pas d\'attribution arbitraire)', async () => {
    const prisma = {
      payment: {
        findUnique: jest.fn().mockResolvedValue({
          bookingId: null,
          allocations: [],
        }),
      },
    };
    const processor = makeProcessor(prisma, send);
    const event = {
      payload: { paymentId: 'pay-3', disputeId: 'dispute-3', openedBy: 'x' },
    } as unknown as DomainEvent<Record<string, unknown>>;

    await expect(
      processor.handleDisputed(event),
    ).resolves.toBeUndefined();
    expect(send).not.toHaveBeenCalled();
  });
});
