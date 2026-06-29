import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { EventModule } from './events/event.module';
import { HealthModule } from './health/health.module';
import { LeasesModule } from './leases/leases.module';
import { LocationsModule } from './locations/locations.module';
import { MandatesModule } from './mandates/mandates.module';
import { PaymentsModule } from './payments/payments.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { UsersModule } from './users/users.module';
import { VisitSlotsModule } from './visit-slots/visit-slots.module';

@Module({
  imports: [
    PrismaModule,
    EventModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    HealthModule,
    LocationsModule,
    PropertiesModule,
    VisitSlotsModule,
    BookingsModule,
    LeasesModule,
    MandatesModule,
    PaymentsModule,
  ],
})
export class AppModule {}
