import { Module } from '@nestjs/common';
import { EventModule } from './events/event.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [PrismaModule, EventModule, HealthModule],
})
export class AppModule {}