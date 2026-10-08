import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import { MandateScope } from '@prisma/client';

/** POST /mandates/:id/counter — revised conditions (spec 03 P2). */
export class CounterMandateDto {
  @IsOptional() @IsArray()
  @IsEnum(MandateScope, { each: true })
  scopes?: MandateScope[];

  @IsOptional() @IsBoolean() exclusive?: boolean;

  @IsOptional() @IsNumber() @Min(0) @Max(1)
  managementFeeRate?: number;
  @IsOptional() @IsNumber() @Min(0) lettingFee?: number;
  @IsOptional() @IsNumber() @Min(0) lettingFeeMonths?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) saleCommissionRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) stayCommissionRate?: number;

  @IsOptional() @IsNumber() @Min(1) @Max(90) approvalTtlDays?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(365) noticeDays?: number;

  @IsOptional() @Type(() => Date) @IsDate() endDate?: Date;

  @IsOptional() @IsString() @MaxLength(500) reason?: string;
}

/** POST /mandates/:id/sign — OTP signature (spec 03 P2). */
export class SignMandateDto {
  /** 6-digit code received by SMS. Omit to request a new code. */
  @IsOptional() @Matches(/^\d{6}$/) code?: string;
}
