import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventPublisher } from '../src/events/event.publisher';
import { DOMAIN_EVENTS } from '../src/events/event.types';

describe('EventModule wiring (e2e)', () => {
  let app: INestApplication;

  afterAll(async () => {
    if (app) await app.close();
  });

  it('EventPublisher is provided and can emit', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [EventPublisher],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const publisher = app.get(EventPublisher);
    expect(publisher).toBeDefined();

    const result = await publisher.emit(DOMAIN_EVENTS.PAYMENT_INITIATED, {
      paymentId: 'pay_test',
      userId: 'usr_test',
      amount: '1000',
      currency: 'XAF',
    });
    expect(result.name).toBe(DOMAIN_EVENTS.PAYMENT_INITIATED);
    expect(result.id).toBeDefined();
  });
});
