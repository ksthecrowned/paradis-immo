import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { MessagingModule } from '../messaging/messaging.module';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { InfobipService } from './infobip.service';
import { FcmService } from './fcm.service';
import { PaymentValidatedProcessor } from './processors/payment-validated.processor';
import { RentReminderProcessor } from './processors/rent-reminder.processor';
import { SolvencyCheckProcessor } from './processors/solvency-check.processor';
import { BuyerPaymentProofProcessor } from './processors/buyer-payment-proof.processor';

@Module({
  imports: [PrismaModule, PaymentsModule, MessagingModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    InfobipService,
    FcmService,
    PaymentValidatedProcessor,
    RentReminderProcessor,
    SolvencyCheckProcessor,
    BuyerPaymentProofProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
