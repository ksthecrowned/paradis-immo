import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { PayoutAdminController } from './payout-admin.controller';
import {
  PayoutAccountsController,
  PayoutSettingsController,
} from './payout-accounts.controller';
import { PayoutCronProcessor } from './payout-cron.processor';

@Module({
  imports: [PrismaModule, EventModule],
  controllers: [
    PayoutsController,
    PayoutAdminController,
    PayoutAccountsController,
    PayoutSettingsController,
  ],
  providers: [PayoutsService, PayoutCronProcessor],
  exports: [PayoutsService],
})
export class PayoutsModule {}
