import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { VisitSlotsService } from './visit-slots.service';
import { SaveVisitReportDto } from './dto/save-visit-report.dto';
import { AssignVisitAgentDto } from './dto/assign-visit-agent.dto';

class BookVisitDto {
  @IsString() slotId!: string;
  @IsString() propertyId!: string;
  /** When set by an owner/agent, book on behalf of this guest (E.164). */
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  guestPhone?: string;

  /** Required when creating a guest that has no Paradis Immo account yet. */
  @IsOptional()
  @IsString()
  @Length(2, 120)
  guestName?: string;
}

/**
 * Visit-booking endpoints. The owner-side flow (`POST /properties/:id/visit-slots/block`,
 * template CRUD) lives in `VisitSlotsController`; this one only deals with
 * `VisitBooking` records (free + paid).
 */
@ApiTags('Visits')
@ApiBearerAuth()
@Controller('visits')
@UseGuards(AppAuthGuard)
export class VisitsController {
  constructor(private readonly slots: VisitSlotsService) {}

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Book a visit slot' })
  book(@CurrentUser() current: AuthenticatedUser, @Body() dto: BookVisitDto) {
    return this.slots.bookVisit(current.userId, dto);
  }

  @Get('my')
  @ApiOperation({ summary: "List the user's own visit bookings" })
  myBookings(@CurrentUser() current: AuthenticatedUser) {
    return this.slots.listMyBookings(current.userId);
  }

  @Get('managed')
  @ApiOperation({ summary: 'List visit bookings on managed properties' })
  managedBookings(@CurrentUser() current: AuthenticatedUser) {
    return this.slots.listManagedBookings(current.userId);
  }

  @Patch(':id/confirm')
  @ApiOperation({ summary: 'Confirm a visit booking' })
  confirm(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.slots.confirmVisit(current.userId, id);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark a visit as completed (agent or manager)' })
  complete(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.slots.completeVisit(current.userId, id);
  }

  @Post(':id/no-show')
  @HttpCode(200)
  @ApiOperation({ summary: 'Mark the visitor as absent (agent or manager)' })
  noShow(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.slots.markVisitNoShow(current.userId, id);
  }

  @Put(':id/report')
  @ApiOperation({ summary: 'Save the visit report (agent or manager)' })
  saveReport(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SaveVisitReportDto,
  ) {
    return this.slots.saveVisitReport(current.userId, id, dto);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign or unassign an agent to a visit' })
  assignAgent(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignVisitAgentDto,
  ) {
    return this.slots.assignVisitAgent(current.userId, id, dto.agentId ?? null);
  }

  @Get('assignable-agents')
  @ApiOperation({ summary: 'List active agents available for visit assignment' })
  assignableAgents(
    @CurrentUser() current: AuthenticatedUser,
    @Query('propertyId') propertyId: string,
  ) {
    if (!propertyId?.trim()) {
      throw new BadRequestException({
        code: 'PROPERTY_ID_REQUIRED',
        message: 'propertyId is required',
      });
    }
    return this.slots.listAssignableVisitAgents(
      current.userId,
      propertyId.trim(),
    );
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a visit booking' })
  cancel(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.slots.cancelVisit(current.userId, id);
  }
}
