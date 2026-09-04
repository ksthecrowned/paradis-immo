import { Module } from '@nestjs/common';
import { InfobipSmsService } from './infobip-sms.service';

/** Technical SMS sending only — no per-message billing. */
@Module({
  providers: [InfobipSmsService],
  exports: [InfobipSmsService],
})
export class MessagingModule {}
