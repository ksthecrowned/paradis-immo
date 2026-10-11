import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VisitSlotsService } from './visit-slots.service';

@Injectable()
export class VisitLifecycleProcessor {
  private readonly logger = new Logger(VisitLifecycleProcessor.name);

  constructor(private readonly slots: VisitSlotsService) {}

  @Cron('*/15 * * * *', { timeZone: 'Africa/Brazzaville' })
  async handleCron(): Promise<void> {
    const reminders = await this.slots.sendVisitReminders();
    if (reminders > 0) {
      this.logger.log(`Sent ${reminders} visit reminder(s)`);
    }
    const marked = await this.slots.markUnconfirmedVisits();
    if (marked > 0) {
      this.logger.log(
        `Marked ${marked} visit(s) as unconfirmed after 24 hours`,
      );
    }
  }
}
