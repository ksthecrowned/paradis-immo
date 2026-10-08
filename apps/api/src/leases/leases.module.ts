import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MandatesModule } from '../mandates/mandates.module';
import { UsersModule } from '../users/users.module';
// OtpStore + InfobipOtpService drive the lease signature by OTP (spec 04).
// AuthModule has no dependency back onto leases, so no forwardRef is needed.
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DocumentsModule } from '../documents/documents.module';
import { RentReceiptService } from './rent-receipt.service';
import { LeasesController } from './leases.controller';
import { RentSchedulesController } from './rent-schedules.controller';
import { EnforcementService } from './enforcement.service';
import { AmendmentsService } from './amendments.service';
import { IndexationService } from './indexation.service';
import { LeaseRenewalProcessor } from './lease-renewal.processor';
import { LeasesService } from './leases.service';
import { ArrearsService } from './arrears.service';
import { RentScheduleGenerator } from './rent-schedule.generator.service';
import { LeaseDocumentsController } from './lease-documents.controller';
import { LeaseDocumentsService } from './lease-documents.service';
import { LeaseTemplatesService } from './lease-templates.service';
import { LeaseTemplatesController } from './lease-templates.controller';

@Module({
  imports: [
    PrismaModule,
    EventModule,
    MandatesModule,
    UsersModule,
    AuthModule,
    MediaModule,
    forwardRef(() => NotificationsModule),
    DocumentsModule,
  ],
  controllers: [
    LeasesController,
    LeaseDocumentsController,
    RentSchedulesController,
    LeaseTemplatesController,
  ],
  providers: [
    LeasesService,
    ArrearsService,
    EnforcementService,
    AmendmentsService,
    IndexationService,
    LeaseRenewalProcessor,
    RentScheduleGenerator,
    LeaseDocumentsService,
    LeaseTemplatesService,
    RentReceiptService,
  ],
  exports: [
    LeasesService,
    ArrearsService,
    EnforcementService,
    AmendmentsService,
    IndexationService,
    RentScheduleGenerator,
    LeaseDocumentsService,
    LeaseTemplatesService,
    RentReceiptService,
  ],
})
export class LeasesModule {}
