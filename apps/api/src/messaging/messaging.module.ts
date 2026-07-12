import { Module } from '@nestjs/common';
import { InfobipSmsService } from './infobip-sms.service';
import { MessagingBillingService } from './messaging-billing.service';

@Module({
  providers: [MessagingBillingService, InfobipSmsService],
  exports: [MessagingBillingService, InfobipSmsService],
})
export class MessagingModule {}
