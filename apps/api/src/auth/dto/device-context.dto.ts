import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Device context accepted by `auth/otp/verify`, `auth/web/*`, `auth/admin/*`
 * and `auth/refresh` (spec 01 — sessions). Every field is optional: older
 * clients simply get a token with a generated deviceId and WEB platform.
 *
 * Used as a base class so the global `whitelist + forbidNonWhitelisted`
 * ValidationPipe keeps accepting these keys on every auth route.
 */
export class DeviceContextDto {
  @ApiPropertyOptional({
    description: 'Stable id generated once per install (persisted client-side).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceId?: string;

  @ApiPropertyOptional({ example: 'iPhone de Jean' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  deviceName?: string;

  @ApiPropertyOptional({ enum: ['IOS', 'ANDROID', 'WEB', 'ADMIN'] })
  @IsOptional()
  @IsIn(['IOS', 'ANDROID', 'WEB', 'ADMIN'])
  platform?: 'IOS' | 'ANDROID' | 'WEB' | 'ADMIN';
}
