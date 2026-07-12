import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MediaModule } from '../media/media.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CashProvider } from './providers/cash.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';
import { ReceiptService } from './receipts/receipt.service';
import { ReceiptController } from './receipts/receipt.controller';
import { PaymentValidatedProcessor } from './receipts/payment-validated.processor';

@Module({
  imports: [PrismaModule, EventModule, MediaModule, MessagingModule],
  controllers: [PaymentsController, ReceiptController],
  providers: [
    PaymentsService,
    CashProvider,
    MobileMoneyProvider,
    ReceiptService,
    PaymentValidatedProcessor,
  ],
  exports: [PaymentsService, ReceiptService],
})
export class PaymentsModule {}
