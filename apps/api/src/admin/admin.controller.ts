import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  PropertyReportStatus,
  PropertyStatus,
} from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AdminService } from './admin.service';

class ModeratePropertyDto {
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class SetFeaturedDto {
  @IsBoolean()
  isFeatured!: boolean;
}

class UpdateReportDto {
  @IsEnum(PropertyReportStatus)
  status!: PropertyReportStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  adminNote?: string;
}

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AppAuthGuard, RolesGuard)
@Roles('PLATFORM_ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide statistics' })
  async stats() {
    const data = await this.admin.getStats();
    return { statusCode: 200, data };
  }

  @Get('users')
  @ApiOperation({ summary: 'List all users' })
  async listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe)
    pageSize: number,
  ) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const result = await this.admin.listUsers(safePage, safeSize);
    return { statusCode: 200, ...result };
  }

  @Get('reports')
  @ApiOperation({ summary: 'List property reports for moderation' })
  async listReports(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(20), ParseIntPipe)
    pageSize: number,
    @Query('status') status?: PropertyReportStatus,
  ) {
    const safePage = Math.max(1, page);
    const safeSize = Math.min(100, Math.max(1, pageSize));
    const result = await this.admin.listReports(
      safePage,
      safeSize,
      status,
    );
    return { statusCode: 200, ...result };
  }

  @Patch('reports/:id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Update a property report status' })
  async updateReport(@Param('id') id: string, @Body() dto: UpdateReportDto) {
    const data = await this.admin.updateReport(id, dto.status, dto.adminNote);
    return { statusCode: 200, data };
  }

  @Patch('properties/:id/moderate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Moderate a property (change status)' })
  async moderate(@Param('id') id: string, @Body() dto: ModeratePropertyDto) {
    const updated = await this.admin.moderateProperty(id, dto.status);
    return {
      statusCode: 200,
      data: {
        id: updated.id,
        status: updated.status,
        ownerId: updated.ownerId,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }

  @Patch('properties/:id/featured')
  @HttpCode(200)
  @ApiOperation({ summary: 'Feature or unfeature a property (marketplace highlight)' })
  async setFeatured(@Param('id') id: string, @Body() dto: SetFeaturedDto) {
    const updated = await this.admin.setPropertyFeatured(id, dto.isFeatured);
    return {
      statusCode: 200,
      data: {
        id: updated.id,
        isFeatured: updated.isFeatured,
        ownerId: updated.ownerId,
        updatedAt: updated.updatedAt.toISOString(),
      },
    };
  }
}
