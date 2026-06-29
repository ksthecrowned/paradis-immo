import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  PriceUnit,
  PropertyMode,
  PropertyType,
  VisitType,
} from '@prisma/client';

export class CreatePropertyDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsEnum(PropertyType)
  type!: PropertyType;

  @IsEnum(PropertyMode)
  mode!: PropertyMode;

  @IsNumber()
  price!: number;

  @IsString()
  currency!: string;

  @IsEnum(PriceUnit)
  priceUnit!: PriceUnit;

  @IsString()
  quartierId!: string;

  @IsString()
  @MinLength(2)
  address!: string;

  @IsString()
  countryId!: string;

  @IsOptional()
  lat?: number;
  @IsOptional()
  lng?: number;

  @IsOptional()
  bedrooms?: number;
  @IsOptional()
  bathrooms?: number;
  @IsOptional()
  surface?: number;

  @IsOptional()
  @IsBoolean()
  visitEnabled?: boolean;
  @IsOptional()
  @IsEnum(VisitType)
  visitType?: VisitType;
  @IsOptional()
  visitPrice?: number;
  @IsOptional()
  visitDuration?: number;
}

export class UpdatePropertyDto {
  @IsOptional() @IsString() @MinLength(3) title?: string;
  @IsOptional() @IsString() @MinLength(10) description?: string;

  @IsOptional() @IsEnum(PropertyMode) mode?: PropertyMode;

  @IsOptional() @IsNumber() price?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsEnum(PriceUnit) priceUnit?: PriceUnit;

  @IsOptional() @IsString() address?: string;
  @IsOptional() lat?: number;
  @IsOptional() lng?: number;

  @IsOptional() bedrooms?: number;
  @IsOptional() bathrooms?: number;
  @IsOptional() surface?: number;

  @IsOptional() @IsBoolean() visitEnabled?: boolean;
  @IsOptional() @IsEnum(VisitType) visitType?: VisitType;
  @IsOptional() visitPrice?: number;
  @IsOptional() visitDuration?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  status?: never; // status changes go through dedicated endpoints (archive, publish)
}
