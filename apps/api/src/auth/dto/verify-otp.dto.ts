import { IsString, Length, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @Matches(/^\+\d{7,15}$/, {
    message: 'phone must be E.164 format (e.g. +242061234567)',
  })
  phone!: string;

  @IsString()
  @Length(6, 6)
  code!: string;
}