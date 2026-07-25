import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateLeaseDto {
  @IsString()
  propertyId!: string;

  /** Preferred: resolve the tenant by E.164 phone. */
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  tenantPhone?: string;

  /** Display name — required when creating a tenant that has no account yet. */
  @IsOptional()
  @IsString()
  @Length(2, 120)
  tenantName?: string;

  /** Legacy: direct user id. Required when tenantPhone is omitted. */
  @ValidateIf((o: CreateLeaseDto) => !o.tenantPhone)
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

export class UpdateLeaseDto {
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
