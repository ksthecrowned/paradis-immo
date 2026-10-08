import {
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
import { DataExportService } from './data-export.service';

@ApiTags('Account')
@ApiBearerAuth()
@Controller('users/me/export')
@UseGuards(AppAuthGuard)
export class DataExportController {
  constructor(private readonly exports: DataExportService) {}

  @Post()
  @HttpCode(202)
  @ApiOperation({ summary: 'Start a personal-data export (spec 01)' })
  async request(@CurrentUser() current: AuthenticatedUser) {
    return this.exports.request(current.userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Export status + signed URL when ready (spec 01)' })
  async get(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.exports.get(current.userId, id);
  }
}
