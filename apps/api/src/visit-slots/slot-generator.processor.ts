import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { VisitSlotGenerator } from './slot-generator';

export const VISIT_SLOT_GENERATION_QUEUE = 'visit.slot.generation';
export const VISIT_SLOT_GENERATION_JOB = 'visit.slot.generation.weekly';

/**
 * BullMQ-backed processor that re-generates visit slots weekly.
 *
 * The actual job is registered as a **repeatable job** (`0 2 * * 0` — every
 * Sunday at 02:00) when the worker boots, so the first run may be up to a
 * week away. Tests can enqueue a one-off job via the same queue to trigger
 * the generation immediately.
 */
@Injectable()
export class SlotGeneratorProcessor implements OnModuleInit {
  private readonly logger = new Logger(SlotGeneratorProcessor.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(private readonly generator: VisitSlotGenerator) {}

  async onModuleInit(): Promise<void> {
    // Only wire BullMQ if a Redis URL is configured. Lets specs run without
    // a live Redis (the pure generator is tested directly).
    if (!process.env.REDIS_URL) {
      this.logger.warn(
        'REDIS_URL not set — skipping weekly slot-generation cron registration',
      );
      return;
    }
    const u = new URL(process.env.REDIS_URL);
    const connection = {
      host: u.hostname || 'localhost',
      port: Number(u.port || 6379),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    };
    this.queue = new Queue(VISIT_SLOT_GENERATION_QUEUE, { connection });
    this.worker = new Worker(
      VISIT_SLOT_GENERATION_QUEUE,
      async () => {
        const result = await this.generator.generateForAllProperties(14);
        this.logger.log(
          `Weekly visit-slot generation: ${result.slots} slots across ${result.properties} properties`,
        );
        return result;
      },
      { connection },
    );

    // Register the weekly cron (idempotent: BullMQ de-dupes by name+pattern).
    await this.queue.add(
      VISIT_SLOT_GENERATION_JOB,
      {},
      {
        repeat: { pattern: '0 2 * * 0' },
        removeOnComplete: 10,
        removeOnFail: 10,
      },
    );
  }
}
