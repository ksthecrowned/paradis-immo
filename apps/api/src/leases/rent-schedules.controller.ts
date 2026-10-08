import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EnforcementService } from './enforcement.service';

@ApiTags('Rent schedules')
@ApiBearerAuth()
@Controller('rent-schedules')
@UseGuards(AppAuthGuard)
export class RentSchedulesController {
  constructor(private readonly enforcement: EnforcementService) {}

  @Post(':id/waive-fee')
  @ApiOperation({ summary: 'Cancel a late fee (manager)' })
  waiveFee(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: Record<string, never>,
  ) {
    void body;
    return this.enforcement.waiveLateFee(current.userId, id);
  }
}
