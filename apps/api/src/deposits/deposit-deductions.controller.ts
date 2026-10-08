import {
  Body,
  Controller,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { DepositsService } from './deposits.service';
import { UpdateDeductionDto } from './dto/update-deduction.dto';

@ApiTags('Deposits')
@ApiBearerAuth()
@Controller('deposit-deductions')
@UseGuards(AppAuthGuard)
export class DepositDeductionsController {
  constructor(private readonly deposits: DepositsService) {}

  @Patch(':id')
  @ApiOperation({
    summary:
      'Tenant contests a deduction (CONTESTED) within 15 days; manager accepts it (ACCEPTED)',
  })
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateDeductionDto,
  ) {
    return this.deposits.updateDeduction(current.userId, id, dto);
  }
}
