import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EventModule } from './events/event.module';
import { HealthModule } from './health/health.module';
import { LocationsModule } from './locations/locations.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { PropertiesModule } from './properties/properties.module';
import { UsersModule } from './users/users.module';

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
  ],
})
export class AppModule {}
