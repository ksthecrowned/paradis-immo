import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventPublisher } from '../src/events/event.publisher';
import { DOMAIN_EVENTS } from '../src/events/event.types';

describe('EventModule wiring (e2e)', () => {
  let app: INestApplication;

  afterAll(async () => {
    if (app) await app.close();
  });

  it('EventPublisher is provided and can emit', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [EventPublisher],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    const publisher = app.get(EventPublisher);
    expect(publisher).toBeDefined();

    // Skip the live BullMQ call when Redis is not reachable locally.
    // The unit test (event.publisher.spec.ts) covers the publish contract
    // by mocking the Queue; this e2e proves end-to-end wiring when Redis is up.
    const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
    let redisReachable = true;
    try {
      const u = new URL(redisUrl);
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const net = require('net') as typeof import('net');
      await new Promise<void>((resolve, reject) => {
        const sock = net.connect({ host: u.hostname, port: Number(u.port || 6379) });
        sock.setTimeout(500);
        sock.once('connect', () => {
          sock.destroy();
          resolve();
        });
        sock.once('error', reject);
        sock.once('timeout', () => reject(new Error('timeout')));
      });
    } catch {
      redisReachable = false;
    }

    if (!redisReachable) {
      // eslint-disable-next-line no-console
      console.warn('[events.e2e] Redis not reachable — skipping live emit assertion');
      return;
    }

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