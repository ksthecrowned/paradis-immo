import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';
import { SaleInquiryStatus } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SalesService } from './sales.service';

class CreateInquiryDto {
  @IsUUID() propertyId!: string;
  @IsOptional() @IsString() message?: string;
}

class UpdateStatusDto {
  @IsIn([
    SaleInquiryStatus.NEW,
    SaleInquiryStatus.CONTACTED,
    SaleInquiryStatus.VISIT_SCHEDULED,
    SaleInquiryStatus.CLOSED,
  ])
  newStatus!: SaleInquiryStatus;
}

@ApiTags('Sales')
@ApiBearerAuth()
@Controller()
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post('sales/inquiries')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Create a sale inquiry' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateInquiryDto,
  ) {
    return this.sales.createInquiry({
      propertyId: dto.propertyId,
      userId: current.userId,
      message: dto.message,
    });
  }

  @Get('sales/inquiries/my')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: "List the buyer's own inquiries" })
  myInquiries(@CurrentUser() current: AuthenticatedUser) {
    return this.sales.listInquiriesForBuyer(current.userId);
  }

  @Get('sales/inquiries/managed')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'List inquiries on managed properties' })
  managed(@CurrentUser() current: AuthenticatedUser) {
    return this.sales.listInquiriesForManager(current.userId);
  }

  @Patch('sales/inquiries/:id/status')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Update inquiry status' })
  updateStatus(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.sales.updateInquiryStatus({
      inquiryId: id,
      actorUserId: current.userId,
      newStatus: dto.newStatus,
    });
  }
}
