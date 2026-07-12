import { IsIn, IsString, Matches } from 'class-validator';

export class RequestOtpDto {
  // E.164: + followed by 7-15 digits. Congo (CG) numbers are +242 followed by 9 digits.
  @IsString()
  @Matches(/^\+\d{7,15}$/, {
    message: 'phone must be E.164 format (e.g. +242061234567)',
  })
  phone!: string;

  /** LOGIN = existing account only; REGISTER = new account. */
  @IsString()
  @IsIn(['LOGIN', 'REGISTER'])
  purpose!: 'LOGIN' | 'REGISTER';
}
