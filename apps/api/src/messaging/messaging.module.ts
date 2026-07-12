import { Module } from '@nestjs/common';
import { InfobipSmsService } from './infobip-sms.service';
import { MessagingBillingService } from './messaging-billing.service';
import { MessagingController } from './messaging.controller';

@Module({
  controllers: [MessagingController],
  providers: [MessagingBillingService, InfobipSmsService],
  exports: [MessagingBillingService, InfobipSmsService],
})
export class MessagingModule {}
