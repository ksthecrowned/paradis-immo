import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './notifications.service';
import { InfobipService } from './infobip.service';
import { FcmService } from './fcm.service';
import { PaymentValidatedProcessor } from './processors/payment-validated.processor';
import { RentReminderProcessor } from './processors/rent-reminder.processor';

@Module({
  imports: [PrismaModule],
  providers: [
    NotificationsService,
    InfobipService,
    FcmService,
    PaymentValidatedProcessor,
    RentReminderProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
