import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * PATCH /mandates/approvals/:id — spec 03: `{ decision, comment }`.
 * The legacy `{ approve, note }` shape is still accepted so existing web
 * clients keep working.
 */
export class DecideApprovalDto {
  @IsOptional() @IsIn(['APPROVE', 'REJECT'])
  decision?: 'APPROVE' | 'REJECT';

  @IsOptional() @IsBoolean()
  approve?: boolean;

  @IsOptional() @IsString() @MaxLength(500)
  comment?: string;

  /** Legacy alias of `comment`. */
  @IsOptional() @IsString() @MaxLength(500)
  note?: string;
}
