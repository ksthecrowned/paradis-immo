import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

/** Contractual terms shared by create and update (spec 04). */
export class LeaseTermsDto {
  /** Day of month the rent is due (1-28). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(28)
  dueDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  chargesAmount?: number;

  @IsOptional()
  @IsIn(['FLAT', 'PROVISION'])
  chargesMode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  noticeMonthsTenant?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(24)
  noticeMonthsLandlord?: number;

  /** Annual indexation rate, e.g. 0.03 for +3 %. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-1)
  @Max(1)
  indexationRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  lateFeeAfterDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lateFeeAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  lateFeeRate?: number;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  autoRenew?: boolean;

  @IsOptional()
  @IsString()
  templateId?: string;
}

export class CreateLeaseDto extends LeaseTermsDto {
  @IsString()
  propertyId!: string;

  /**
   * Phone of the tenant. Known accounts are linked; unknown numbers are only
   * stored as `invitedPhone` — no silent `User` creation (spec 04).
   */
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  invitedPhone?: string;

  /** Backward-compatible alias of `invitedPhone`. */
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  tenantPhone?: string;

  /** Display name of the invited tenant. */
  @IsOptional()
  @IsString()
  @Length(2, 120)
  tenantName?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deposit!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;
}

export class UpdateLeaseDto extends LeaseTermsDto {
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  invitedPhone?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  tenantPhone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 120)
  tenantName?: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deposit?: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}