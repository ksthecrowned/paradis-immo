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
  IsDate,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { BookingsService } from './bookings.service';
import { AvailabilityService } from './availability.service';
import { CreateBookingDto } from './dto/create-booking.dto';

class AvailabilityQueryDto {
  @IsOptional() @Type(() => Date) @IsDate() from?: Date;
  @IsOptional() @Type(() => Date) @IsDate() to?: Date;
}

class StayQuoteQueryDto {
  @Type(() => Date) @IsDate() startDate!: Date;
  @Type(() => Date) @IsDate() endDate!: Date;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) guests?: number;
}

class ReasonDto {
  @IsOptional()
  @IsString()
  @Length(1, 500)
  reason?: string;
}

class DamageReportDto {
  @IsString()
  @Length(5, 1000)
  description!: string;

  @IsString()
  @Length(1, 20)
  amount!: string;
}

@ApiTags('Bookings')
@ApiBearerAuth()
@Controller()
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly availability: AvailabilityService,
  ) {}

  @Get('properties/:id/availability')
  @ApiOperation({ summary: 'List availability blocks for a property' })
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
  @ApiOperation({ summary: 'Create a short-stay booking (hold 15 min + devis)' })
  create(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: CreateBookingDto,
  ) {
    return this.bookings.createBooking(current.userId, dto);
  }

  /** Spec 07 — devis avant réservation (public : lecture seule). */
  @Get('properties/:id/stay-quote')
  @ApiOperation({ summary: 'Pricing quote for a short-stay request' })
  quote(@Param('id') id: string, @Query() query: StayQuoteQueryDto) {
    return this.bookings.quote(id, {
      startDate: query.startDate,
      endDate: query.endDate,
      guests: query.guests ?? 2,
    });
  }

  @Get('bookings/my')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: "List the authenticated user's bookings" })
  myBookings(@CurrentUser() current: AuthenticatedUser) {
    return this.bookings.listMyBookings(current.userId);
  }

  @Get('bookings/managed')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'List bookings on managed properties' })
  managed(@CurrentUser() current: AuthenticatedUser) {
    return this.bookings.listManaged(current.userId);
  }

  @Patch('bookings/:id/cancel')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Cancel a booking (guest, politique 07)' })
  cancel(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.bookings.cancelBooking(current.userId, id);
  }

  @Post('bookings/:id/cancel')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel a booking (guest, politique 07)' })
  cancelPost(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.bookings.cancelBooking(current.userId, id);
  }

  /** Spec 07 — montant remboursé si annulation maintenant. */
  @Get('bookings/:id/cancellation-preview')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Aperçu du remboursement si annulation maintenant' })
  cancellationPreview(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.bookings.cancellationPreview(current.userId, id);
  }

  /** Spec 07 — annulation hôte : 100 % voyageur. */
  @Post('bookings/:id/host-cancel')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: "Annulation hôte (remboursement 100 %)" })
  hostCancel(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.bookings.cancelByHost(current.userId, id, dto.reason);
  }

  /** Spec 07 — hôte accepte une demande (hold 2 h pour payer). */
  @Post('bookings/:id/accept')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: "Accepter une demande (REQUESTED → ACCEPTED)" })
  accept(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.bookings.acceptBooking(current.userId, id);
  }

  /** Spec 07 — hôte refuse une demande. */
  @Post('bookings/:id/decline')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: "Refuser une demande (REQUESTED → DECLINED)" })
  decline(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReasonDto,
  ) {
    return this.bookings.declineBooking(current.userId, id, dto.reason);
  }

  /** Spec 07 — check-in hôte. */
  @Post('bookings/:id/check-in')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Check-in voyageur (hôte)' })
  checkIn(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.bookings.checkIn(current.userId, id);
  }

  /** Spec 07 — check-out hôte (→ COMPLETED). */
  @Post('bookings/:id/check-out')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Check-out voyageur (hôte)' })
  checkOut(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.bookings.checkOut(current.userId, id);
  }

  /** Spec 07 — instructions d'arrivée (révélées ≤ 48 h avant). */
  @Get('bookings/:id/arrival')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: "Instructions d'arrivée (voyageur)" })
  arrival(@CurrentUser() current: AuthenticatedUser, @Param('id') id: string) {
    return this.bookings.getArrival(current.userId, id);
  }

  /** Spec 07 — dommage signalé sous 48 h après le départ (hôte). */
  @Post('bookings/:id/damage-reports')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiOperation({ summary: 'Signaler un dommage (hôte, sous 48 h)' })
  reportDamage(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: DamageReportDto,
  ) {
    return this.bookings.reportDamage(current.userId, id, dto);
  }
}
