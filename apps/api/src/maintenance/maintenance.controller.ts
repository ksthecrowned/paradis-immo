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
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { MaintenancePriority, MaintenanceStatus } from '@prisma/client';
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
}

class UpdateTicketDto {
  @IsOptional() @IsEnum(MaintenanceStatus) status?: MaintenanceStatus;
  @IsOptional() @IsNumber() estimatedCost?: number;
}

class AssignTicketDto {
  @IsUUID() assigneeId!: string;
}

@Controller()
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Post('maintenance/tickets')
  @UseGuards(AppAuthGuard)
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
    });
  }

  @Get('maintenance/tickets/my')
  @UseGuards(AppAuthGuard)
  mine(@CurrentUser() current: AuthenticatedUser) {
    return this.maintenance.listMine(current.userId);
  }

  @Get('maintenance/tickets/managed')
  @UseGuards(AppAuthGuard)
  managed(@CurrentUser() current: AuthenticatedUser) {
    return this.maintenance.listForActor(current.userId);
  }

  @Get('maintenance/tickets')
  @UseGuards(AppAuthGuard)
  list(@CurrentUser() current: AuthenticatedUser) {
    return this.maintenance.listForActor(current.userId);
  }

  @Patch('maintenance/tickets/:id')
  @UseGuards(AppAuthGuard)
  update(@Param('id') id: string, @Body() dto: UpdateTicketDto) {
    return this.maintenance.updateTicket(id, {
      status: dto.status,
      estimatedCost: dto.estimatedCost,
    });
  }

  @Patch('maintenance/tickets/:id/assign')
  @UseGuards(AppAuthGuard)
  assign(@Param('id') id: string, @Body() dto: AssignTicketDto) {
    return this.maintenance.assignTicket(id, dto.assigneeId);
  }
}
