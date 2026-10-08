import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, Min } from 'class-validator';

/**
 * Spec 04 US 11 — `POST /leases/:id/renew` : nouveau terme, loyer révisé
 * éventuel. Sous mandat vivant, un changement de loyer passe par une
 * approbation RENT_INCREASE / RENT_REDUCTION avant d'être appliqué.
 */
export class RenewLeaseDto {
  /** New end of the lease; must be after the current end date. */
  @Type(() => Date)
  @IsDate()
  newEndDate!: Date;

  /** Rent of the new term. Omitted = the rent does not change. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  newMonthlyRent?: number;
}
