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
import { DocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { DocumentsService } from './documents.service';
import { MAX_PHOTO_BYTES } from './media.service';

class UploadDocumentMetaDto {
  @IsEnum(DocumentType)
  type!: DocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

@ApiTags('Documents')
@Controller('properties/:id/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List documents for a property' })
  list(@Param('id') id: string) {
    return this.documents.list(id);
  }

  @Post('upload')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PHOTO_BYTES + 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload a property document (PDF or image)' })
  upload(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
        }
      | undefined,
    @Body() meta: UploadDocumentMetaDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Multipart field "file" is required',
      });
    }
    return this.documents.upload(current.userId, id, file, meta);
  }

  @Delete(':documentId')
  @UseGuards(AppAuthGuard)
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a property document' })
  async remove(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.documents.remove(current.userId, id, documentId);
  }
}
