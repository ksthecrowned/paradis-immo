import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LeaseStatus } from '@prisma/client';

export class ListLeasesDto {
  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
