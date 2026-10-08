import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class LogoutDto {
  @ApiProperty({ description: 'Refresh token to revoke' })
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}

export class LogoutAllDto {
  @ApiProperty({
    required: false,
    description:
      'Keep the presented refresh token alive (default: revoke every session)',
  })
  @IsOptional()
  @IsString()
  @MinLength(20)
  refreshToken?: string;

  @ApiProperty({
    required: false,
    default: true,
    description: 'Revoke the current session too (default true)',
  })
  @IsOptional()
  includeCurrent?: boolean;
}
