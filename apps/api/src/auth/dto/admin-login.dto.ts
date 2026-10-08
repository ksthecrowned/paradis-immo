import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DeviceContextDto } from './device-context.dto';

export class AdminLoginDto extends DeviceContextDto {
  @ApiProperty({ example: 'admin@paradisimmo.cg' })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}
