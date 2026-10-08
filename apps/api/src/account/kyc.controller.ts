import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { KycService } from './kyc.service';

class SubmitKycMetaDto {
  @IsString()
  @MaxLength(40)
  documentType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  organizationId?: string;
}

@ApiTags('KYC')
@ApiBearerAuth()
@Controller('kyc/submissions')
@UseGuards(AppAuthGuard)
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Post()
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 16 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Submit an identity / business document (spec 01)' })
  async submit(
    @CurrentUser() current: AuthenticatedUser,
    @UploadedFile()
    file:
      | { buffer: Buffer; originalname: string; mimetype: string }
      | undefined,
    @Body() meta: SubmitKycMetaDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Multipart field "file" is required',
      });
    }
    return this.kyc.submit(current.userId, file, meta);
  }

  @Get('mine')
  @ApiOperation({ summary: 'My KYC submissions (spec 01)' })
  async mine(@CurrentUser() current: AuthenticatedUser) {
    return { submissions: await this.kyc.mine(current.userId) };
  }
}
