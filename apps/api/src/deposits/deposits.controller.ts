import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DepositsService } from './deposits.service';
import { CreateDeductionDto } from './dto/create-deduction.dto';
import { SettleDepositDto } from './dto/settle-deposit.dto';

@ApiTags('Deposits')
@ApiBearerAuth()
@Controller('leases')
@UseGuards(AppAuthGuard)
export class DepositsController {
  constructor(private readonly deposits: DepositsService) {}

  @Get(':id/deposit')
  @ApiOperation({ summary: 'Deposit state: collected amount, deductions, refund' })
  getSummary(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.deposits.getSummary(current.userId, id);
  }

  @Post(':id/deposit/deductions')
  @HttpCode(201)
  @ApiOperation({ summary: 'Propose a deduction on the exit inspection' })
  proposeDeduction(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateDeductionDto,
  ) {
    return this.deposits.proposeDeduction(current.userId, id, dto);
  }

  @Post(':id/deposit/settle')
  @HttpCode(201)
  @ApiOperation({
    summary:
      'Settle the deposit (refund = deposit − accepted deductions) and queue the payout',
  })
  settle(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SettleDepositDto,
  ) {
    return this.deposits.settleDeposit(current.userId, id, dto);
  }
}
