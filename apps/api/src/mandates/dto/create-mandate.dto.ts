import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { MandateScope } from '@prisma/client';

/** POST /mandates — owner proposes a mandate with its conditions (spec 03 US 1). */
export class CreateMandateDto {
  @IsString() propertyId!: string;
  @IsString() organizationId!: string;

  @IsOptional() @Type(() => Date) @IsDate() endDate?: Date;

  @IsOptional() @IsArray()
  @IsEnum(MandateScope, { each: true })
  scopes?: MandateScope[];

  @IsOptional() @IsBoolean() exclusive?: boolean;

  /** Fraction des loyers encaissés, ex. 0.08 pour 8 %. */
  @IsOptional() @IsNumber() @Min(0) @Max(1)
  managementFeeRate?: number;

  @IsOptional() @IsNumber() @Min(0) lettingFee?: number;
  @IsOptional() @IsNumber() @Min(0) lettingFeeMonths?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) saleCommissionRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Max(1) stayCommissionRate?: number;

  @IsOptional() @IsNumber() @Min(0) repairApprovalThreshold?: number;
  @IsOptional() @IsBoolean() rentChangeRequiresApproval?: boolean;
  @IsOptional() @IsBoolean() leaseSignRequiresApproval?: boolean;
  @IsOptional() @IsNumber() @Min(0) minSalePrice?: number;

  @IsOptional() @IsInt() @Min(1) @Max(90) approvalTtlDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(365) noticeDays?: number;
  @IsOptional() @IsBoolean() tacitRenewal?: boolean;
}
