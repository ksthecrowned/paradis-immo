import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MediaModule } from '../media/media.module';
import { AuthModule } from '../auth/auth.module';
import { RentScheduleGenerator } from '../leases/rent-schedule.generator.service';
import { AgencyAccessService } from './agency-access.service';
import { MandatesController } from './mandates.controller';
import { MandatesService } from './mandates.service';
import { MandateApprovalService } from './mandate-approval.service';
import { MandateDocumentReviewService } from './mandate-document-review.service';
import { AuditLogModule } from '../common/audit-log.module';

@Module({
  // MediaModule already imports MandatesModule (agency access checks), so
  // the reference is circular and must be declared with forwardRef on both
  // sides. R2 is needed to store generated amendment PDFs (spec 03).
  // AuthModule provides OtpStore + InfobipOtpService for the electronic
  // signature flow (spec 03 P2) — it has no dependency back onto mandates.
  imports: [
    PrismaModule,
    EventModule,
    AuthModule,
    AuditLogModule,
    forwardRef(() => MediaModule),
  ],
  controllers: [MandatesController],
  providers: [
    MandatesService,
    MandateApprovalService,
    MandateDocumentReviewService,
    AgencyAccessService,
    RentScheduleGenerator,
  ],
  exports: [
    MandatesService,
    MandateApprovalService,
    MandateDocumentReviewService,
    AgencyAccessService,
  ],
})
export class MandatesModule {}
