import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import {
  CreatePropertyDto,
  UpdatePropertyDto,
} from './dto/create-property.dto';
import { FilterPropertiesDto } from './dto/filter-properties.dto';
import { PropertiesService } from './properties.service';

/**
 * Property CRUD + marketplace filter endpoints.
 *
 * Reads are public (browsing the marketplace requires no auth).
 * Writes are protected by `AppAuthGuard` (JWT in prod, `x-test-user` in test).
 */
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  // Public reads ----------------------------------------------------

  @Get()
  list(@Query() filter: FilterPropertiesDto) {
    return this.properties.list(filter);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.properties.getOne(id);
  }

  // Authenticated writes -------------------------------------------

  @Post()
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.properties.create(current.userId, dto);
  }

  @Patch(':id')
  @UseGuards(AppAuthGuard)
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    return this.properties.update(current.userId, id, dto);
  }

  @Post(':id/archive')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  archive(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.properties.archive(current.userId, id);
  }
}
