import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { MandatesModule } from '../mandates/mandates.module';
import { UsersModule } from '../users/users.module';
import { VisitSlotsController } from './visit-slots.controller';
import { VisitsController } from './visits.controller';
import { VisitSlotsService } from './visit-slots.service';
import { SlotGeneratorProcessor } from './slot-generator.processor';
import { VisitSlotGenerator } from './slot-generator';
import { HoldExpiryProcessor } from './hold-expiry.processor';
import { VisitLifecycleProcessor } from './visit-lifecycle.processor';

@Module({
  imports: [PrismaModule, EventModule, MandatesModule, UsersModule],
  controllers: [VisitSlotsController, VisitsController],
  providers: [
    VisitSlotsService,
    VisitSlotGenerator,
    SlotGeneratorProcessor,
    HoldExpiryProcessor,
    VisitLifecycleProcessor,
  ],
  exports: [VisitSlotsService, VisitSlotGenerator],
})
export class VisitSlotsModule {}
