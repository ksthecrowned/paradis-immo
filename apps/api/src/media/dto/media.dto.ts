import { IsEnum, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';
import { MediaType } from '@prisma/client';

export class PresignMediaDto {
  @IsString()
  filename!: string;

  @IsString()
  contentType!: string;

  @IsEnum(MediaType)
  type!: MediaType;
}

export class ConfirmMediaDto {
  @IsUrl({ require_tld: false, require_protocol: true })
  url!: string;

  @IsEnum(MediaType)
  type!: MediaType;

  @IsOptional()
  @IsInt()
  position?: number;
}
