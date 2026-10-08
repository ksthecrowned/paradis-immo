import { IsOptional, IsString, Matches } from 'class-validator';

/**
 * Spec 04 — lease electronic signature.
 *
 * `otpCode` is optional on purpose: omitting it asks for a fresh code
 * (WhatsApp), sending it signs the lease. Same contract as the mandate
 * signature (`SignMandateDto`).
 */
export class SignLeaseDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otpCode must be 6 digits' })
  otpCode?: string;
}
