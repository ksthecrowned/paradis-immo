import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { AgencyAccessService } from './agency-access.service';
import { MandatesController } from './mandates.controller';
import { MandatesService } from './mandates.service';
import { MandateApprovalService } from './mandate-approval.service';

@Module({
  imports: [PrismaModule, EventModule],
  controllers: [MandatesController],
  providers: [MandatesService, MandateApprovalService, AgencyAccessService],
  exports: [MandatesService, MandateApprovalService, AgencyAccessService],
})
export class MandatesModule {}
