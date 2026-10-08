import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceContextDto } from './device-context.dto';

export class AdminGoogleDto extends DeviceContextDto {
  @ApiProperty({ description: 'Google ID token from Sign in with Google' })
  @IsString()
  @MinLength(20)
  idToken!: string;
}
