import { Test, TestingModule } from '@nestjs/testing';
import { EventPublisher } from './event.publisher';
import { DOMAIN_EVENTS } from './event.types';

describe('EventPublisher', () => {
  let publisher: EventPublisher;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [EventPublisher],
    }).compile();
    publisher = moduleRef.get(EventPublisher);
    publisher.onModuleInit();
  });

  afterEach(async () => {
    await publisher.onModuleDestroy();
  });

  it('emits PAYMENT_VALIDATED and returns job metadata', async () => {
    const payload = {
      paymentId: 'pay_123',
      userId: 'usr_1',
      amount: '50000',
      currency: 'XAF',
    };

    // Spy on the internal queue to capture the add call without requiring Redis
    const queueAddSpy = jest.fn().mockResolvedValue({ id: 'job_abc' });
    const fakeQueue = { add: queueAddSpy, close: jest.fn() };
    const fakeQueueEvents = { close: jest.fn() };

    // Inject the fake queue + queueEvents
    (publisher as unknown as {
      queues: Map<string, unknown>;
      queueEvents: Map<string, unknown>;
    }).queues.set(DOMAIN_EVENTS.PAYMENT_VALIDATED, fakeQueue);
    (publisher as unknown as {
      queueEvents: Map<string, unknown>;
    }).queueEvents.set(DOMAIN_EVENTS.PAYMENT_VALIDATED, fakeQueueEvents);

    const result = await publisher.emit(DOMAIN_EVENTS.PAYMENT_VALIDATED, payload);

    expect(result.name).toBe(DOMAIN_EVENTS.PAYMENT_VALIDATED);
    expect(result.id).toBe('job_abc');
    expect(queueAddSpy).toHaveBeenCalledTimes(1);
    const [jobName, jobData] = queueAddSpy.mock.calls[0];
    expect(jobName).toBe(DOMAIN_EVENTS.PAYMENT_VALIDATED);
    expect(jobData).toMatchObject({
      name: DOMAIN_EVENTS.PAYMENT_VALIDATED,
      payload,
    });
    expect(typeof jobData.emittedAt).toBe('string');
  });

  it('reuses the same queue for repeated emits of the same event', async () => {
    const fakeQueue = { add: jest.fn().mockResolvedValue({ id: 'job_x' }), close: jest.fn() };
    const fakeQueueEvents = { close: jest.fn() };
    (publisher as unknown as { queues: Map<string, unknown> }).queues.set(
      DOMAIN_EVENTS.LEASE_CREATED,
      fakeQueue,
    );
    (publisher as unknown as { queueEvents: Map<string, unknown> }).queueEvents.set(
      DOMAIN_EVENTS.LEASE_CREATED,
      fakeQueueEvents,
    );

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

    expect(fakeQueue.add).toHaveBeenCalledTimes(2);
  });
});