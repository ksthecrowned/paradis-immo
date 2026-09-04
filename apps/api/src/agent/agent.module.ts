import { Module } from '@nestjs/common';
import { MandatesModule } from '../mandates/mandates.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AgentController } from './agent.controller';
import { AgentStatsService } from './agent-stats.service';

@Module({
  imports: [PrismaModule, MandatesModule],
  controllers: [AgentController],
  providers: [AgentStatsService],
})
export class AgentModule {}
