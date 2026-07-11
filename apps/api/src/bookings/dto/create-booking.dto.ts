import { Type } from 'class-transformer';
import { IsDate, IsString } from 'class-validator';

export class CreateBookingDto {
  @IsString()
  propertyId!: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;
}
