import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MandatesModule } from '../mandates/mandates.module';
import { MediaModule } from '../media/media.module';
import { LeasesModule } from '../leases/leases.module';
import { DocumentsModule } from '../documents/documents.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CashProvider } from './providers/cash.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';
import { PaymentExpiryProcessor } from './payment-expiry.processor';
import { ReceiptService } from './receipts/receipt.service';
import { ReceiptController } from './receipts/receipt.controller';
import { PaymentValidatedProcessor } from './receipts/payment-validated.processor';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';

@Module({
  imports: [
    PrismaModule,
    EventModule,
    MediaModule,
    MandatesModule,
    forwardRef(() => LeasesModule),
    DocumentsModule,
  ],
  controllers: [PaymentsController, ReceiptController, ReconciliationController],
  providers: [
    PaymentsService,
    CashProvider,
    MobileMoneyProvider,
    ReceiptService,
    PaymentValidatedProcessor,
    PaymentExpiryProcessor,
    ReconciliationService,
  ],
  exports: [PaymentsService, ReceiptService],
})
export class PaymentsModule {}
