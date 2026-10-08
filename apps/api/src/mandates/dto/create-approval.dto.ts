import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { MandateActionType } from '@prisma/client';

const ACTION_TYPES: MandateActionType[] = [
  'LEASE_SIGN',
  'RENT_REDUCTION',
  'MAJOR_REPAIR',
  'SALE_PRICE',
  'SALE_OFFER_ACCEPT',
  'EXPENSE',
];

/** POST /mandates/:id/approvals — agent/gérant submits an action (US 9). */
export class CreateApprovalDto {
  @IsIn(ACTION_TYPES)
  actionType!: MandateActionType;

  /** LEASE | MAINTENANCE_TICKET | SALE_OFFER | EXPENSE | PROPERTY */
  @IsOptional() @IsString() sourceType?: string;
  @IsOptional() @IsString() sourceId?: string;

  @IsOptional() @IsObject()
  payload?: Record<string, unknown>;
}
