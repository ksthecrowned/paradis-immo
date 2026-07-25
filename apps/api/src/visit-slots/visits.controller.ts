import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, Length, Matches } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { VisitSlotsService } from './visit-slots.service';

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

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a visit booking' })
  cancel(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.slots.cancelVisit(current.userId, id);
  }
}
