import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/**
 * Spec 04 — candidature à une annonce `RENT_LONG`.
 *
 * The supporting pieces (identity, justificatifs) live in the reusable
 * tenant file (`users/me/tenant-file`), not on the application itself, so
 * the same documents can be reused from one candidature to the next.
 */
export class CreateApplicationDto {
  /** Desired move-in date (ISO 8601). */
  @IsDateString()
  desiredMoveIn!: string;

  /** Number of people moving in, including the applicant. */
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  occupants!: number;

  /** Profession of the applicant. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  occupation?: string;

  /** Declared monthly income, in the property currency. */
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined || value === null || value === ''
      ? undefined
      : Number(value),
  )
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  declaredIncome?: number;

  /** Free-text message to the manager. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  message?: string;
}