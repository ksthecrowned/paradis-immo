import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WebRegisterDto {
  @ApiProperty({ example: 'owner@example.com' })
  @IsEmail()
  email!: string;
}

export class WebMagicConsumeDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  token!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class WebLoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;
}

export class WebGoogleDto {
  @ApiProperty()
  @IsString()
  @MinLength(20)
  idToken!: string;
}

export class WebRoleDto {
  @ApiProperty({ enum: ['OWNER', 'AGENT'] })
  @IsIn(['OWNER', 'AGENT'])
  role!: 'OWNER' | 'AGENT';
}
