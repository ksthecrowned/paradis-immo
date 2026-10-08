import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { PayoutsService } from './payouts.service';
import { ListPayoutsQueryDto } from './dto/payouts.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/payouts')
@UseGuards(AppAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN')
export class PayoutAdminController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get()
  @ApiOperation({ summary: 'File des reversements (admin plateforme)' })
  list(@Query() query: ListPayoutsQueryDto) {
    return this.payouts.listAdmin(query);
  }

  @Post(':id/retry')
  @ApiOperation({ summary: 'Relance manuelle d un reversement échoué' })
  retry(@Param('id') id: string) {
    return this.payouts.retry(id);
  }
}
