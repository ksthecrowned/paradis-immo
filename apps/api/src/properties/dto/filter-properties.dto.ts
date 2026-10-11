import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  PropertyMode,
  PropertyStatus,
  PropertyType,
} from '@prisma/client';

export class FilterPropertiesDto {
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
  @Type(() => Number) @IsInt() @Min(0)
  minBedrooms?: number;

  @IsOptional()
  @Type(() => Number) @IsInt() @Min(0)
  minBathrooms?: number;

  @IsOptional()
  @Type(() => Number) @IsInt() @Min(0)
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
  arrondissementId?: string;

  @IsOptional()
  @IsString()
  quartierId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

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
