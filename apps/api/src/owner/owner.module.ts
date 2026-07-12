import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnerController } from './owner.controller';
import { OwnerStatsService } from './owner-stats.service';

@Module({
  imports: [PrismaModule],
  controllers: [OwnerController],
  providers: [OwnerStatsService],
})
export class OwnerModule {}
