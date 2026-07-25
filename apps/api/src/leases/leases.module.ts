import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MandatesModule } from '../mandates/mandates.module';
import { UsersModule } from '../users/users.module';
import { MediaModule } from '../media/media.module';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { RentScheduleGenerator } from './rent-schedule.generator.service';
import { LeaseDocumentsController } from './lease-documents.controller';
import { LeaseDocumentsService } from './lease-documents.service';

@Module({
  imports: [PrismaModule, EventModule, MandatesModule, UsersModule, MediaModule],
  controllers: [LeasesController, LeaseDocumentsController],
  providers: [LeasesService, RentScheduleGenerator, LeaseDocumentsService],
  exports: [LeasesService, RentScheduleGenerator, LeaseDocumentsService],
})
export class LeasesModule {}
