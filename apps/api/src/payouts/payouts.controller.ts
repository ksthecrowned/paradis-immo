import { Body, Controller, Get, HttpCode, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { PayoutsService } from './payouts.service';
import { ListPayoutsQueryDto, RequestPayoutDto } from './dto/payouts.dto';

@ApiTags('Payouts')
@ApiBearerAuth()
@Controller('payouts')
@UseGuards(AppAuthGuard)
export class PayoutsController {
  constructor(private readonly payouts: PayoutsService) {}

  @Get('mine')
  @ApiOperation({ summary: 'Reversements reçus (OWNER)' })
  listMine(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: ListPayoutsQueryDto,
  ) {
    return this.payouts.listMine(current.userId, query);
  }

  @Post('request')
  @HttpCode(201)
  @ApiOperation({ summary: 'Reversement à la demande (solde ≥ minPayoutAmount)' })
  request(@CurrentUser() current: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return this.payouts.requestPayout(current.userId, dto);
  }
}
