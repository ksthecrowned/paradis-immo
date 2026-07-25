import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OptionalUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import { CreatePropertyReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('properties/:id/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @UseGuards(OptionalAuthGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Report a public listing' })
  create(
    @OptionalUser() current: AuthenticatedUser | null,
    @Param('id') id: string,
    @Body() dto: CreatePropertyReportDto,
  ) {
    return this.reports.create(
      current?.userId ?? null,
      id,
      dto.reason,
      dto.description,
      dto.deviceId,
    );
  }
}
