import { IsOptional, IsString, Length } from 'class-validator';

export class RecordPropertyViewDto {
  /** Persistent install identifier — required for anonymous viewers. */
  @IsOptional()
  @IsString()
  @Length(1, 64)
  deviceId?: string;
}
