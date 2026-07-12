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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
@ApiTags('Properties')
@ApiBearerAuth()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  // Public reads ----------------------------------------------------

  @Get()
  @ApiOperation({ summary: 'List active properties (public marketplace)' })
  list(@Query() filter: FilterPropertiesDto) {
    return this.properties.list(filter);
  }

  // IMPORTANT: keep this route ABOVE `@Get(':id')` in source order so that
  // NestJS does not interpret the literal "mine" as a property id.
  @Get('mine')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: "List the authenticated user's properties" })
  listMine(
    @CurrentUser() current: AuthenticatedUser,
    @Query() filter: FilterPropertiesDto,
  ) {
    return this.properties.listMine(current.userId, filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single property by id' })
  getOne(@Param('id') id: string) {
    return this.properties.getOne(id);
  }

  // Authenticated writes -------------------------------------------

  @Post()
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Create a new property' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreatePropertyDto,
  ) {
    return this.properties.create(current.userId, dto);
  }

  @Patch(':id')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Update an existing property' })
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
  @ApiOperation({ summary: 'Archive a property' })
  archive(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.properties.archive(current.userId, id);
  }

  @Post(':id/publish')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Publish a DRAFT or PAUSED property (→ ACTIVE)' })
  publish(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.properties.publish(current.userId, id);
  }

  @Post(':id/pause')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Pause an ACTIVE property' })
  pause(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.properties.pause(current.userId, id);
  }
}
