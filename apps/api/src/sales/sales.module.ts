import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MandatesModule } from '../mandates/mandates.module';
import { UsersModule } from '../users/users.module';
import { EventModule } from '../events/event.module';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { SaleAgreementsService } from './sale-agreements.service';
import { BuyerPaymentProofsService } from './buyer-payment-proofs.service';
import {
  MeSaleAgreementsController,
  SaleAgreementsController,
} from './sale-agreements.controller';
import {
  MeBuyerPaymentProofsController,
  SaleAgreementPaymentProofsController,
} from './buyer-payment-proofs.controller';

@Module({
  imports: [PrismaModule, MandatesModule, UsersModule, EventModule],
  controllers: [
    SalesController,
    SaleAgreementsController,
    MeSaleAgreementsController,
    SaleAgreementPaymentProofsController,
    MeBuyerPaymentProofsController,
  ],
  providers: [SalesService, SaleAgreementsService, BuyerPaymentProofsService],
  exports: [SalesService, SaleAgreementsService, BuyerPaymentProofsService],
})
export class SalesModule {}
