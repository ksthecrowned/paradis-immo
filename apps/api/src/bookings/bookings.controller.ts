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
import { IsDate, IsOptional, IsString } from 'class-validator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { AvailabilityService } from './availability.service';

class CreateBookingDto {
  @IsString() propertyId!: string;
  @Type(() => Date) @IsDate() startDate!: Date;
  @Type(() => Date) @IsDate() endDate!: Date;
}

class AvailabilityQueryDto {
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}

@Controller()
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get('properties/:id/availability')
  listAvailability(
    @Param('id') id: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.availability.listAvailability(id, {
      from: query.from,
      to: query.to,
    });
  }

  @Post('bookings')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookings.createBooking(current.userId, dto);
  }

  @Get('bookings/my')
  @UseGuards(AppAuthGuard)
  myBookings(@CurrentUser() current: AuthenticatedUser) {
    return this.bookings.listMyBookings(current.userId);
  }

  @Patch('bookings/:id/cancel')
  @UseGuards(AppAuthGuard)
  cancel(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.bookings.cancelBooking(current.userId, id);
  }
}
