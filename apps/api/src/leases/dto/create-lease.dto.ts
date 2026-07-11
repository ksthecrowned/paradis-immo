import { Type } from 'class-transformer';
import {
  IsDate,
  IsNumber,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class CreateLeaseDto {
  @IsString()
  propertyId!: string;

  @IsString()
  tenantId!: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlyRent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deposit!: number;

  @IsString()
  @Length(3, 3)
  currency!: string;
}
