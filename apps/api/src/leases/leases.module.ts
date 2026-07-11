import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MandatesModule } from '../mandates/mandates.module';
import { LeasesController } from './leases.controller';
import { LeasesService } from './leases.service';
import { RentScheduleGenerator } from './rent-schedule.generator.service';

@Module({
  imports: [PrismaModule, EventModule, MandatesModule],
  controllers: [LeasesController],
  providers: [LeasesService, RentScheduleGenerator],
  exports: [LeasesService, RentScheduleGenerator],
})
export class LeasesModule {}
