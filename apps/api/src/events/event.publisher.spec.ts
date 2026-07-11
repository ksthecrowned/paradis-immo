import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventPublisher } from './event.publisher';
import { DOMAIN_EVENTS } from './event.types';

describe('EventPublisher', () => {
  let publisher: EventPublisher;
  let emitter: EventEmitter2;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        EventPublisher,
        {
          provide: EventEmitter2,
          useValue: {
            listeners: jest.fn().mockReturnValue([]),
            emitAsync: jest.fn().mockResolvedValue(true),
          },
        },
      ],
    }).compile();
    publisher = moduleRef.get(EventPublisher);
    emitter = moduleRef.get(EventEmitter2);
  });

  it('emits PAYMENT_VALIDATED via EventEmitter2', async () => {
    const payload = {
      paymentId: 'pay_123',
      userId: 'usr_1',
      amount: '50000',
      currency: 'XAF',
    };

    const result = await publisher.emit(DOMAIN_EVENTS.PAYMENT_VALIDATED, payload);

    expect(result.name).toBe(DOMAIN_EVENTS.PAYMENT_VALIDATED);
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(emitter.emitAsync).toHaveBeenCalledWith(
      DOMAIN_EVENTS.PAYMENT_VALIDATED,
      expect.objectContaining({
        name: DOMAIN_EVENTS.PAYMENT_VALIDATED,
        payload,
      }),
    );
  });

  it('emits multiple events of the same type', async () => {
    await publisher.emit(DOMAIN_EVENTS.LEASE_CREATED, {
      leaseId: 'l_1',
      propertyId: 'p_1',
      tenantId: 't_1',
    });
    await publisher.emit(DOMAIN_EVENTS.LEASE_CREATED, {
      leaseId: 'l_2',
      propertyId: 'p_2',
      tenantId: 't_2',
    });

    expect(emitter.emitAsync).toHaveBeenCalledTimes(2);
  });
});
