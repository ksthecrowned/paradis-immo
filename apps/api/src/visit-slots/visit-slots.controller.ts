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
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { VisitSlotsService } from './visit-slots.service';

class CreateTemplateDto {
  @Type(() => Number) @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @Matches(/^\d{2}:\d{2}$/) startTime!: string;
  @Matches(/^\d{2}:\d{2}$/) endTime!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(1440) slotMinutes!: number;
}

class BlockSlotDto {
  @IsDateString() startAt!: string;
  @IsDateString() endAt!: string;
}

class AvailableSlotsQueryDto {
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() propertyId?: string;
}

/**
 * Visit-slot management endpoints. Templates and manual blocks are owner/
 * agent-only; the read endpoint for available slots is public (marketplace).
 */
@Controller()
export class VisitSlotsController {
  constructor(private readonly slots: VisitSlotsService) {}

  @Post('properties/:id/visit-templates')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  createTemplate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.slots.createTemplate(current.userId, id, dto);
  }

  @Get('properties/:id/visit-templates')
  listTemplates(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.slots.listTemplates(current.userId, id);
  }

  @Patch('visit-templates/:templateId/deactivate')
  @UseGuards(AppAuthGuard)
  deactivateTemplate(
    @CurrentUser() current: AuthenticatedUser,
    @Param('templateId') templateId: string,
  ) {
    return this.slots.deactivateTemplate(current.userId, templateId);
  }

  @Post('properties/:id/visit-slots/block')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  blockSlot(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: BlockSlotDto,
  ) {
    return this.slots.blockSlot(current.userId, id, {
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
    });
  }

  @Get('properties/:id/visit-slots')
  listAvailable(
    @Param('id') id: string,
    @Query() query: AvailableSlotsQueryDto,
  ) {
    return this.slots.listAvailableSlots(id, {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }
}
