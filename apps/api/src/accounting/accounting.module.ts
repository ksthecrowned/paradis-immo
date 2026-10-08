import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MediaModule } from '../media/media.module';
import { MandatesModule } from '../mandates/mandates.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';
import { ExpensesService } from './expenses.service';
import { LedgerProcessor } from './ledger.processor';

@Module({
  imports: [
    PrismaModule,
    EventModule,
    MediaModule,
    MandatesModule,
    NotificationsModule,
  ],
  controllers: [AccountingController],
  providers: [AccountingService, ExpensesService, LedgerProcessor],
  exports: [AccountingService, ExpensesService],
})
export class AccountingModule {}
