import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import {
  DomainEvent,
  DomainEventName,
  EventPayloadOf,
} from './event.types';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

interface RedisConnectionOptions {
  host: string;
  port: number;
  password?: string;
}

function parseRedisUrl(url: string): RedisConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname || 'localhost',
    port: Number(u.port || 6379),
    ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
  };
}

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private connection!: RedisConnectionOptions;
  private queues = new Map<DomainEventName, Queue>();
  private queueEvents = new Map<DomainEventName, QueueEvents>();

  onModuleInit() {
    this.connection = parseRedisUrl(REDIS_URL);
  }

  async onModuleDestroy() {
    for (const queueEvents of this.queueEvents.values()) {
      await queueEvents.close();
    }
    for (const queue of this.queues.values()) {
      await queue.close();
    }
  }

  /**
   * Emit a domain event. Lazily creates the queue for the event on first emit.
   * Returns the BullMQ job id and name.
   */
  async emit<E extends DomainEventName>(
    name: E,
    payload: EventPayloadOf<E>,
  ): Promise<{ id: string; name: E }> {
    const queue = this.getQueue(name);
    const event: DomainEvent<EventPayloadOf<E>> = {
      name,
      payload,
      emittedAt: new Date().toISOString(),
    };
    const job = await queue.add(name, event, {
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 100 },
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });
    return { id: String(job.id), name };
  }

  private getQueue(name: DomainEventName): Queue {
    let queue = this.queues.get(name);
    if (queue) return queue;
    queue = new Queue(name, {
      connection: this.connection,
      defaultJobOptions: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      },
    });
    this.queues.set(name, queue);
    const queueEvents = new QueueEvents(name, { connection: this.connection });
    queueEvents.on('completed', ({ jobId }) => {
      this.logger.debug(`Event ${name} (job ${jobId}) completed`);
    });
    queueEvents.on('failed', ({ jobId, failedReason }) => {
      this.logger.warn(`Event ${name} (job ${jobId}) failed: ${failedReason}`);
    });
    this.queueEvents.set(name, queueEvents);
    return queue;
  }
}