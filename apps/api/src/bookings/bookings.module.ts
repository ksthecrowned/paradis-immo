import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { UsersModule } from '../users/users.module';
import { MandatesModule } from '../mandates/mandates.module';
import { BookingsService } from './bookings.service';
import { PricingService } from './pricing.service';
import { StaySettingsService } from './stay-settings.service';
import { AvailabilityService } from './availability.service';
import { BookingsController } from './bookings.controller';
import { StaySettingsController } from './stay-settings.controller';
import { HoldExpiryProcessor } from './hold-expiry.processor';

@Module({
  imports: [PrismaModule, EventModule, UsersModule, MandatesModule],
  controllers: [BookingsController, StaySettingsController],
  providers: [
    BookingsService,
    PricingService,
    StaySettingsService,
    AvailabilityService,
    HoldExpiryProcessor,
  ],
  exports: [BookingsService, PricingService, StaySettingsService, AvailabilityService],
})
export class BookingsModule {}
