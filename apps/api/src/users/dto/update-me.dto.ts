import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'avatarUrl must be a valid URL' })
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  fcmToken?: string;

  /** Explicit alert delivery preference. SMS is billed to the managing org. */
  @IsOptional()
  @IsIn(['PUSH', 'SMS'])
  notificationChannel?: 'PUSH' | 'SMS';

  @IsOptional()
  @IsIn(['RENT', 'BUY', 'VISIT', 'ALL_OPTIONS'])
  seekerIntent?: 'RENT' | 'BUY' | 'VISIT' | 'ALL_OPTIONS';

  @IsOptional()
  @IsIn(['FIRST_TIME', 'RETURNING', 'PRO'])
  seekerExperience?: 'FIRST_TIME' | 'RETURNING' | 'PRO';

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMinXaf?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMaxXaf?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  preferredQuartierIds?: string[];

  /** When true, server sets seekerSetupCompletedAt = now(). */
  @IsOptional()
  @IsBoolean()
  completeSeekerSetup?: boolean;
}
