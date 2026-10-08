import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { TerminationInitiator } from '@prisma/client';

export class TerminateLeaseDto {
  @IsEnum(TerminationInitiator)
  initiator!: TerminationInitiator;

  @IsOptional()
  @IsString()
  @Length(3, 1000)
  reason?: string;

  /**
   * Desired exit date. The effective date is at least
   * `noticeAt + noticeMonths`, so an earlier date is clamped.
   */
  @Type(() => Date)
  @IsDate()
  requestedEndDate!: Date;
}

export class WithdrawTerminationDto {
  @IsOptional()
  @IsString()
  @Length(3, 1000)
  reason?: string;
}