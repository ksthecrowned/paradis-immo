import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  PriceUnit,
  PropertyMode,
  PropertyType,
  VisitType,
  ListingStatus,
  PropertyFeatureId,
  MapViewId,
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

  // -------- Building / lot details --------
  // floor, condition, orientation, landTitle stay as free strings —
  // values are documented but not strictly enumerated (mobile keeps
  // the same convention).
  @IsOptional()
  @IsString()
  @MaxLength(50)
  floor?: string;

  @IsOptional()
  @IsInt()
  @Min(1800)
  @Max(2100)
  yearBuilt?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  condition?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lotSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  parkingSpaces?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  orientation?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  landTitle?: string;

  // -------- Equipment / features --------
  @IsOptional()
  @IsArray()
  @IsEnum(PropertyFeatureId, { each: true })
  features?: PropertyFeatureId[];

  // -------- Immersive map views --------
  @IsOptional()
  @IsArray()
  @IsEnum(MapViewId, { each: true })
  mapViews?: MapViewId[];

  // -------- Marketplace listing --------
  @IsOptional()
  @IsEnum(ListingStatus)
  listingStatus?: ListingStatus;

  @IsOptional()
  @IsDateString()
  availableFrom?: string | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  // -------- Visit configuration --------
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

  /** Rent deposit in months (location). */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(24)
  depositMonths?: number;

  /** Agency fee in listing currency. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  agencyFeeAmount?: number;
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

  // -------- Building / lot details --------
  @IsOptional() @IsString() @MaxLength(50) floor?: string;
  @IsOptional() @IsInt() @Min(1800) @Max(2100) yearBuilt?: number;
  @IsOptional() @IsString() @MaxLength(80) condition?: string;
  @IsOptional() @IsNumber() @Min(0) lotSize?: number;
  @IsOptional() @IsInt() @Min(0) parkingSpaces?: number;
  @IsOptional() @IsString() @MaxLength(50) orientation?: string;
  @IsOptional() @IsString() @MaxLength(80) landTitle?: string;

  // -------- Equipment / features --------
  @IsOptional()
  @IsArray()
  @IsEnum(PropertyFeatureId, { each: true })
  features?: PropertyFeatureId[];

  // -------- Immersive map views --------
  @IsOptional()
  @IsArray()
  @IsEnum(MapViewId, { each: true })
  mapViews?: MapViewId[];

  // -------- Marketplace listing --------
  @IsOptional()
  @IsEnum(ListingStatus)
  listingStatus?: ListingStatus;

  @IsOptional()
  @IsDateString()
  availableFrom?: string | null;

  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @IsOptional()
  @IsBoolean()
  visitEnabled?: boolean;
  @IsOptional() @IsEnum(VisitType) visitType?: VisitType;
  @IsOptional() visitPrice?: number;
  @IsOptional() visitDuration?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsInt()
  @Min(0)
  @Max(24)
  depositMonths?: number | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsNumber()
  @Min(0)
  agencyFeeAmount?: number | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object)
  status?: never; // status changes go through dedicated endpoints (archive, publish)
}
