import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsService } from './notifications.service';
import { InfobipService } from './infobip.service';
import { FcmService } from './fcm.service';
import { PaymentValidatedProcessor } from './processors/payment-validated.processor';

@Module({
  imports: [PrismaModule],
  providers: [
    NotificationsService,
    InfobipService,
    FcmService,
    PaymentValidatedProcessor,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
