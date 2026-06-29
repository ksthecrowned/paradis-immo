import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { VisitSlotsController } from './visit-slots.controller';
import { VisitsController } from './visits.controller';
import { VisitSlotsService } from './visit-slots.service';
import { SlotGeneratorProcessor } from './slot-generator.processor';
import { VisitSlotGenerator } from './slot-generator';

@Module({
  imports: [PrismaModule, EventModule],
  controllers: [VisitSlotsController, VisitsController],
  providers: [VisitSlotsService, VisitSlotGenerator, SlotGeneratorProcessor],
  exports: [VisitSlotsService, VisitSlotGenerator],
})
export class VisitSlotsModule {}
