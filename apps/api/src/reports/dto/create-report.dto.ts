import { IsEnum, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { PropertyReportReason } from '@prisma/client';

export class CreatePropertyReportDto {
  @IsEnum(PropertyReportReason)
  reason!: PropertyReportReason;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  /** Persistent install id — required for anonymous reporters. */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  deviceId?: string;
}
