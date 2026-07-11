import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MandatesService } from './mandates.service';
import { MandateApprovalService } from './mandate-approval.service';
import { DecideApprovalDto } from './dto/decide-approval.dto';

class CreateMandateDto {
  @IsString() propertyId!: string;
  @IsString() organizationId!: string;
  @IsOptional() @Type(() => Date) @IsDate() endDate?: Date;
}

@ApiTags('Mandates')
@ApiBearerAuth()
@Controller('mandates')
@UseGuards(AppAuthGuard)
export class MandatesController {
  constructor(
    private readonly mandates: MandatesService,
    private readonly approvals: MandateApprovalService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a mandate (delegation to an org)' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateMandateDto,
  ) {
    return this.mandates.createMandate(current.userId, dto);
  }

  @Get('pending-approvals')
  @ApiOperation({ summary: 'List pending owner approvals' })
  pending(@CurrentUser() current: AuthenticatedUser) {
    return this.approvals.listPendingForOwner(current.userId);
  }

  @Patch('approvals/:id')
  @ApiOperation({ summary: 'Approve or reject a pending approval' })
  decide(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.decideApproval(current.userId, id, dto);
  }
}
