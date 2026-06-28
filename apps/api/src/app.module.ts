import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EventModule } from './events/event.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    EventModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
