import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateExternalAgencyClientDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName!: string;

  @ApiProperty({ description: 'E.164 phone' })
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string;
}

export class LinkExistingUserDto {
  @ApiProperty({ description: 'E.164 phone of an existing account' })
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string;
}

export class UpdateAgencyClientDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNote?: string | null;
}

export class LookupAgencyClientPhoneDto {
  @ApiProperty({ description: 'E.164 phone' })
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  phone!: string;
}

export class ListAgencyClientsQueryDto {
  @ApiPropertyOptional({ description: '1-based page', default: 1 })
  @IsOptional()
  @IsString()
  page?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsString()
  pageSize?: string;

  @ApiPropertyOptional({
    enum: ['all', 'linked', 'external', 'archived'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'linked', 'external', 'archived'])
  filter?: 'all' | 'linked' | 'external' | 'archived';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;
}
