import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventModule } from '../events/event.module';
import { UsersModule } from '../users/users.module';
import { BookingsService } from './bookings.service';
import { AvailabilityService } from './availability.service';
import { BookingsController } from './bookings.controller';

@Module({
  imports: [PrismaModule, EventModule, UsersModule],
  controllers: [BookingsController],
  providers: [BookingsService, AvailabilityService],
  exports: [BookingsService, AvailabilityService],
})
export class BookingsModule {}
