import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { OwnerStatsService } from './owner-stats.service';

@ApiTags('Owner')
@ApiBearerAuth()
@Controller('owner')
@UseGuards(AppAuthGuard)
export class OwnerController {
  constructor(private readonly stats: OwnerStatsService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Owner portfolio KPI counters' })
  getStats(@CurrentUser() current: AuthenticatedUser) {
    return this.stats.getStats(current.userId);
  }
}
