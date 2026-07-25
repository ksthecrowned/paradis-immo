import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
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
import { LeaseDocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { MAX_PHOTO_BYTES } from '../media/media.service';
import { LeaseDocumentsService } from './lease-documents.service';

class UploadLeaseDocumentMetaDto {
  @IsEnum(LeaseDocumentType)
  type!: LeaseDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

@ApiTags('Lease documents')
@ApiBearerAuth()
@Controller('leases/:leaseId/documents')
@UseGuards(AppAuthGuard)
export class LeaseDocumentsController {
  constructor(private readonly docs: LeaseDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents for a lease' })
  list(
    @CurrentUser() current: AuthenticatedUser,
    @Param('leaseId') leaseId: string,
  ) {
    return this.docs.list(current.userId, leaseId);
  }

  @Post('upload')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PHOTO_BYTES + 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload a lease contract document' })
  upload(
    @CurrentUser() current: AuthenticatedUser,
    @Param('leaseId') leaseId: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
        }
      | undefined,
    @Body() meta: UploadLeaseDocumentMetaDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Multipart field "file" is required',
      });
    }
    return this.docs.upload(current.userId, leaseId, file, meta);
  }

  @Delete(':documentId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a lease document' })
  async remove(
    @CurrentUser() current: AuthenticatedUser,
    @Param('leaseId') leaseId: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.docs.remove(current.userId, leaseId, documentId);
  }
}
