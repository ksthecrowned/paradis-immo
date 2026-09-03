import { IsBoolean } from 'class-validator';

export class RespondBuyerPaymentProofDto {
  @IsBoolean()
  accept!: boolean;
}
