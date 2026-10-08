import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MandatesModule } from '../mandates/mandates.module';
import { DepositsService } from './deposits.service';
import { DepositsController } from './deposits.controller';
import { DepositDeductionsController } from './deposit-deductions.controller';

@Module({
  // MandatesModule provides AgencyAccessService, the same authorisation the
  // lease lifecycle uses. The J+25 alert cron is scheduled globally.
  imports: [PrismaModule, MandatesModule],
  controllers: [DepositsController, DepositDeductionsController],
  providers: [DepositsService],
  exports: [DepositsService],
})
export class DepositsModule {}
