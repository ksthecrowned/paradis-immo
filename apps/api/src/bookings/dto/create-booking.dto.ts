import { Type } from 'class-transformer';
import {
  IsDate,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateBookingDto {
  @IsString()
  propertyId!: string;

  @Type(() => Date)
  @IsDate()
  startDate!: Date;

  @Type(() => Date)
  @IsDate()
  endDate!: Date;

  /** When set by an owner/agent, book on behalf of this guest (E.164). */
  @IsOptional()
  @IsString()
  @Matches(/^\+\d{7,15}$/)
  guestPhone?: string;

  /** Required when creating a guest that has no Paradis Immo account yet. */
  @IsOptional()
  @IsString()
  @Length(2, 120)
  guestName?: string;
}
