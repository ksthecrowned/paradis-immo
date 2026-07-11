import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VisitSlotGenerator } from './slot-generator';

/**
 * Re-generates visit slots weekly (Sunday 02:00 UTC).
 */
@Injectable()
export class SlotGeneratorProcessor {
  private readonly logger = new Logger(SlotGeneratorProcessor.name);

  constructor(private readonly generator: VisitSlotGenerator) {}

  @Cron('0 2 * * 0')
  async runWeekly(): Promise<void> {
    const result = await this.generator.generateForAllProperties(14);
    this.logger.log(
      `Weekly visit-slot generation: ${result.slots} slots across ${result.properties} properties`,
    );
  }
}
