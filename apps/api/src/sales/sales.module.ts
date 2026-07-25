import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MandatesModule } from '../mandates/mandates.module';
import { UsersModule } from '../users/users.module';
import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { SaleAgreementsService } from './sale-agreements.service';
import {
  MeSaleAgreementsController,
  SaleAgreementsController,
} from './sale-agreements.controller';

@Module({
  imports: [PrismaModule, MandatesModule, UsersModule],
  controllers: [
    SalesController,
    SaleAgreementsController,
    MeSaleAgreementsController,
  ],
  providers: [SalesService, SaleAgreementsService],
  exports: [SalesService, SaleAgreementsService],
})
export class SalesModule {}
