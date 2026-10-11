import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceStatus,
} from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MaintenanceService } from './maintenance.service';

class CreateTicketDto {
  @IsUUID() propertyId!: string;
  @IsString() title!: string;
  @IsString() description!: string;

  @IsOptional() @IsEnum(MaintenancePriority) priority?: MaintenancePriority;

  @IsOptional() @IsNumber() estimatedCost?: number;

  @IsOptional() @IsUUID() mandateId?: string;

  /** Spec 15 A1 — contexte, catégorie et disponibilités. */
  @IsOptional() @IsUUID() leaseId?: string;
  @IsOptional() @IsUUID() bookingId?: string;
  @IsOptional() @IsEnum(MaintenanceCategory) category?: MaintenanceCategory;
  @IsOptional() @IsString() @MaxLength(500) availability?: string;
  @IsOptional() @IsBoolean() entryPermission?: boolean;
}

class TransitionTicketDto {
  @IsEnum(MaintenanceStatus) to!: MaintenanceStatus;
  @IsOptional() @IsString() @MaxLength(500) note?: string;
  @IsOptional() @IsDateString() scheduledAt?: string;
  @IsOptional() @IsNumber() actualCost?: number;
  @IsOptional() @IsString() @MaxLength(500) cancelReason?: string;
}

// Spec 15 A1 — le statut ne passe plus par PATCH : POST …/transitions.
class UpdateTicketDto {
  @IsOptional() @IsNumber() estimatedCost?: number;
}

class AssignTicketDto {
  @IsUUID() assigneeId!: string;
}

@ApiTags('Maintenance')
@ApiBearerAuth()
@Controller()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Post('maintenance/tickets')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Open a maintenance ticket' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateTicketDto,
  ) {
    return this.maintenance.createTicket({
      propertyId: dto.propertyId,
      reporterId: current.userId,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      estimatedCost: dto.estimatedCost,
      mandateId: dto.mandateId,
      leaseId: dto.leaseId,
      bookingId: dto.bookingId,
      category: dto.category,
      availability: dto.availability,
      entryPermission: dto.entryPermission,
    });
  }

  @Post('maintenance/tickets/:id/transitions')
  @UseGuards(AppAuthGuard)
  @ApiOperation({
    summary: 'Machine à états : transition contrôlée (spec 15 A1)',
  })
  transition(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: TransitionTicketDto,
  ) {
    return this.maintenance.transition(current.userId, id, {
      to: dto.to,
      note: dto.note,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      actualCost: dto.actualCost,
      cancelReason: dto.cancelReason,
    });
  }

  @Get('maintenance/tickets/my')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'List tickets reported by the user' })
  mine(@CurrentUser() current: AuthenticatedUser) {
    return this.maintenance.listMine(current.userId);
  }

  @Get('maintenance/tickets/managed')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'List tickets on managed properties' })
  managed(@CurrentUser() current: AuthenticatedUser) {
    return this.maintenance.listForActor(current.userId);
  }

  @Get('maintenance/tickets')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'List tickets visible to the actor' })
  list(@CurrentUser() current: AuthenticatedUser) {
    return this.maintenance.listForActor(current.userId);
  }

  @Get('maintenance/tickets/:id')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Get a maintenance ticket by id' })
  getOne(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.maintenance.getOne(current.userId, id);
  }

  @Patch('maintenance/tickets/:id')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Update descriptive fields (estimatedCost) — statut via /transitions' })
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.maintenance.updateTicket(current.userId, id, {
      estimatedCost: dto.estimatedCost,
    });
  }

  @Patch('maintenance/tickets/:id/assign')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Assign a ticket to a technician' })
  assign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignTicketDto,
  ) {
    return this.maintenance.assignTicket(
      current.userId,
      id,
      dto.assigneeId,
    );
  }
}
