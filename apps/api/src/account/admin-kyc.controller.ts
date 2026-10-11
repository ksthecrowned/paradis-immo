import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';  import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { KycStatus } from '@prisma/client';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminPermissionGuard } from '../admin/admin-permission.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { KycService } from './kyc.service';
import { AdminPermissionGuard, AdminPermission } from '../admin/admin-permission.guard';

class ReviewKycDto {
  @IsEnum(KycStatus)
  status!: KycStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  rejectionReason?: string;
}

@ApiTags('Admin · KYC')
@ApiBearerAuth()
@Controller('admin/kyc/submissions')
@UseGuards(AppAuthGuard, RolesGuard, AdminPermissionGuard)
@Roles('PLATFORM_ADMIN')
export class AdminKycController {
  constructor(private readonly kyc: KycService) {}

  @Get()
  @AdminPermission('kyc.review')
  @ApiOperation({ summary: 'List KYC submissions for review (spec 01 / 12)' })
  async list(@Query('status') status?: KycStatus) {
    return { submissions: await this.kyc.listForAdmin(status) };
  }

  @Patch(':id')
  @HttpCode(200)
  @AdminPermission('kyc.review')
  @ApiOperation({ summary: 'Validate or reject a KYC dossier (spec 01)' })
  async review(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.kyc.review(current.userId, id, {
      status: dto.status as 'VERIFIED' | 'REJECTED',
      rejectionReason: dto.rejectionReason,
    });
  }
}
