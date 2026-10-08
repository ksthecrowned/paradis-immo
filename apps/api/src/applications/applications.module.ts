import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MandatesModule } from '../mandates/mandates.module';
import { LeasesModule } from '../leases/leases.module';
import { forwardRef } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RentalApplicationsService } from './rental-applications.service';
import {
  ApplicationsController,
  PropertyApplicationsController,
} from './rental-applications.controller';
import { SolvencyDecidedProcessor } from './solvency-decided.processor';
import { ApplicationNotificationsProcessor } from './application-notifications.processor';

/** Spec 04 — candidatures (rental applications) and candidate solvency. */
@Module({
  imports: [
    PrismaModule,
    EventModule,
    MandatesModule,
    LeasesModule,
    // NotificationsModule -> PaymentsModule -> LeasesModule -> ApplicationsModule:
    // forwardRef breaks the JS-level cycle.
    forwardRef(() => NotificationsModule),
  ],
  controllers: [PropertyApplicationsController, ApplicationsController],
  providers: [
    RentalApplicationsService,
    SolvencyDecidedProcessor,
    ApplicationNotificationsProcessor,
  ],
  exports: [RentalApplicationsService],
})
export class ApplicationsModule {}