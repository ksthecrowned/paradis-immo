import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

/**
 * Spec 04 — decision on a candidature.
 *
 * `ACCEPTED` auto-rejects every sibling application on the same property;
 * `rejectionMessage` is then the message the losers receive (it is
 * customisable per decision).
 */
export class UpdateApplicationDto {
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  rejectionMessage?: string;
}