import { Module } from '@nestjs/common';
import { MessagingBillingService } from './messaging-billing.service';

@Module({
  providers: [MessagingBillingService],
  exports: [MessagingBillingService],
})
export class MessagingModule {}
