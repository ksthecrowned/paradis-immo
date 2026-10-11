import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsDateString,
} from 'class-validator';

export class SaveVisitReportDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  interestLevel?: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @IsOptional()
  @IsIn(['APPLY', 'OFFER', 'FOLLOW_UP', 'NONE'])
  nextStep?: 'APPLY' | 'OFFER' | 'FOLLOW_UP' | 'NONE';

  @IsOptional()
  @IsDateString()
  followUpAt?: string;
}
