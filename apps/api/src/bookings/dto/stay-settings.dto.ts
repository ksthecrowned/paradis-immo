import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsDecimal,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Spec 07 — `PUT properties/:id/stay-settings` (gestionnaire). */
export class UpsertStaySettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0)
  baseNightlyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0)
  weekendNightlyRate?: number | null;

  /** Fractions en décimal : 0.10 = −10 %. */
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0)
  @Max(0.99)
  weeklyDiscount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0)
  @Max(0.99)
  monthlyDiscount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0)
  cleaningFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  baseGuests?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxGuests?: number;

  @IsOptional()
  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0)
  extraGuestFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minNights?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxNights?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  advanceNoticeHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bookingWindowDays?: number;

  @IsOptional()
  @IsBoolean()
  instantBook?: boolean;

  @IsOptional()
  @IsIn(['FLEXIBLE', 'MODERATE', 'STRICT'])
  cancellationPolicy?: string;

  @IsOptional()
  @IsIn(['NONE', 'COLLECT_ON_BOOKING', 'ON_SITE'])
  depositMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  checkInFrom?: string;

  @IsOptional()
  @Matches(/^\d{2}:\d{2}$/)
  checkOutBefore?: string;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  houseRules?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 4000)
  arrivalInstructions?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,4' })
  @Min(0)
  @Max(0.5)
  serviceFeeRate?: number;
}

/** Spec 07 — `POST properties/:id/seasonal-rates`. */
export class CreateSeasonalRateDto {
  @Type(() => Date)
  @IsDateString()
  startDate!: Date;

  @Type(() => Date)
  @IsDateString()
  endDate!: Date;

  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0)
  nightlyRate!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minNights?: number;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  label?: string;
}

/** Spec 07 — `PATCH properties/:id/seasonal-rates/:rateId`. */
export class UpdateSeasonalRateDto {
  @IsOptional()
  @Type(() => Date)
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDateString()
  endDate?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsDecimal({ decimal_digits: '0,2' })
  @Min(0)
  nightlyRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minNights?: number | null;

  @IsOptional()
  @IsString()
  @Length(0, 120)
  label?: string | null;
}
