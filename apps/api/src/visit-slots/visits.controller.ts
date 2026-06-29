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
import { IsString } from 'class-validator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { VisitSlotsService } from './visit-slots.service';

class BookVisitDto {
  @IsString() slotId!: string;
  @IsString() propertyId!: string;
}

/**
 * Visit-booking endpoints. The owner-side flow (`POST /properties/:id/visit-slots/block`,
 * template CRUD) lives in `VisitSlotsController`; this one only deals with
 * `VisitBooking` records (free + paid).
 */
@Controller('visits')
@UseGuards(AppAuthGuard)
export class VisitsController {
  constructor(private readonly slots: VisitSlotsService) {}

  @Post()
  @HttpCode(201)
  book(@CurrentUser() current: AuthenticatedUser, @Body() dto: BookVisitDto) {
    return this.slots.bookVisit(current.userId, dto);
  }

  @Get('my')
  myBookings(@CurrentUser() current: AuthenticatedUser) {
    return this.slots.listMyBookings(current.userId);
  }

  @Get('managed')
  managedBookings(@CurrentUser() current: AuthenticatedUser) {
    return this.slots.listManagedBookings(current.userId);
  }

  @Patch(':id/confirm')
  confirm(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.slots.confirmVisit(current.userId, id);
  }

  @Patch(':id/cancel')
  cancel(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.slots.cancelVisit(current.userId, id);
  }
}
