import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsService } from './notifications.service';
import { InfobipService } from './infobip.service';
import { FcmService } from './fcm.service';
import { PaymentValidatedProcessor } from './processors/payment-validated.processor';
import { RentReminderProcessor } from './processors/rent-reminder.processor';

@Module({
  imports: [PrismaModule, PaymentsModule, MessagingModule],
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
