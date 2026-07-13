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
}

class UpdateTicketDto {
  @IsOptional() @IsEnum(MaintenanceStatus) status?: MaintenanceStatus;
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
  @ApiOperation({ summary: 'Update a ticket status or estimated cost' })
  update(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.maintenance.updateTicket(current.userId, id, {
      status: dto.status,
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
