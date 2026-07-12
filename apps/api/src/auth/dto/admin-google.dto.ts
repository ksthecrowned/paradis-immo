import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminGoogleDto {
  @ApiProperty({ description: 'Google ID token from Sign in with Google' })
  @IsString()
  @MinLength(20)
  idToken!: string;
}
