import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDate,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Spec 04 US 7 — colocation: who joins (phones) and who leaves (user ids)
 * the lease. Applied once both parties signed the amendment.
 */
export class CoTenantsChangesDto {
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  @Matches(/^\+?[0-9]{6,15}$/, { each: true })
  add?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  remove?: string[];
}

/**
 * Spec 04 US 7 — the terms an amendment can change. At least one field is
 * required; the service validates the resulting dates.
 */
export class AmendmentChangesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  chargesAmount?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;

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

  /** Spec 04 US 7 — colocataire rejoint ou quitte le bail. */
  @IsOptional()
  @ValidateNested()
  @Type(() => CoTenantsChangesDto)
  coTenants?: CoTenantsChangesDto;
}

export class CreateAmendmentDto {
  @IsObject()
  @ValidateNested()
  @Type(() => AmendmentChangesDto)
  changes!: AmendmentChangesDto;

  /** First month the new terms apply to. Defaults to today. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveFrom?: Date;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  reason?: string;
}
