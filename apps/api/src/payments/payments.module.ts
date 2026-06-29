import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { CashProvider } from './providers/cash.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';

@Module({
  imports: [PrismaModule, EventModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, CashProvider, MobileMoneyProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
