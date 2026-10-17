import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PropertyMode, PropertyStatus, PropertyType } from '@prisma/client';

export class FilterPropertiesDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(PropertyMode)
  mode?: PropertyMode;

  @IsOptional()
  @IsEnum(PropertyStatus)
  status?: PropertyStatus;

  /** Spec 15 B4 — filtres complets (13 P1). */
  @IsOptional()
  @IsEnum(PropertyType)
  type?: PropertyType;

  @IsOptional()
  @IsString()
  types?: string;

  @IsOptional()
  @IsBooleanString()
  availableOnly?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  minYearBuilt?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1800)
  maxYearBuilt?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBathrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minSurface?: number;

  /** Tous requis (AND) : features[] en query (ex. ?features=piscine,parking). */
  @IsOptional()
  @Type(() => String)
  features?: string;

  @IsOptional()
  @IsString()
  furnished?: string; // "true" | "false"

  /** price_asc | price_desc | newest | surface */
  @IsOptional()
  @IsString()
  sort?: string;

  @IsOptional()
  @IsString()
  countryCode?: string;

  @IsOptional()
  @IsString()
  cityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  cityName?: string;

  @IsOptional()
  @IsString()
  arrondissementId?: string;

  @IsOptional()
  @IsString()
  quartierId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  minLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  maxLat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  minLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  maxLng?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
