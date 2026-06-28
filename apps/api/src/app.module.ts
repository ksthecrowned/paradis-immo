import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { EventModule } from './events/event.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, EventModule, AuthModule, HealthModule],
})
export class AppModule {}
