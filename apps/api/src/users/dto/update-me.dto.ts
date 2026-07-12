import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
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
}
