import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnerController } from './owner.controller';
import { OwnerStatsService } from './owner-stats.service';
import { MandatesModule } from '../mandates/mandates.module';

@Module({
  imports: [PrismaModule, MandatesModule],
  controllers: [OwnerController],
  providers: [OwnerStatsService],
})
export class OwnerModule {}
