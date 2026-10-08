import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateLeaseTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  /** Contract body; placeholders are replaced when the lease is generated. */
  @IsString()
  @MinLength(10)
  @MaxLength(200_000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateLeaseTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(200_000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}