import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { AgentStatsService } from './agent-stats.service';

@ApiTags('Agent')
@ApiBearerAuth()
@Controller('agent')
@UseGuards(AppAuthGuard)
export class AgentController {
  constructor(private readonly stats: AgentStatsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Agent portfolio KPI counters' })
  getStats(@CurrentUser() current: AuthenticatedUser) {
    return this.stats.getStats(current.userId);
  }
}
