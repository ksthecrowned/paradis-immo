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
import { TenantDocumentType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { MAX_PHOTO_BYTES } from '../media/media.service';
import { TenantDocumentsService } from './tenant-documents.service';

class UploadTenantDocumentMetaDto {
  @IsEnum(TenantDocumentType)
  type!: TenantDocumentType;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

@ApiTags('Tenant documents')
@ApiBearerAuth()
@Controller()
@UseGuards(AppAuthGuard)
export class TenantDocumentsController {
  constructor(private readonly docs: TenantDocumentsService) {}

  @Get('me/documents')
  @ApiOperation({ summary: 'List identity documents for the current user' })
  listMine(@CurrentUser() current: AuthenticatedUser) {
    return this.docs.listMine(current.userId);
  }

  @Get('tenants/:userId/documents')
  @ApiOperation({ summary: 'List identity documents for a managed tenant' })
  listManaged(
    @CurrentUser() current: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    return this.docs.listForManagedTenant(current.userId, userId);
  }

  @Post('tenants/:userId/documents/upload')
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PHOTO_BYTES + 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload an identity document for a managed tenant' })
  upload(
    @CurrentUser() current: AuthenticatedUser,
    @Param('userId') userId: string,
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname: string;
          mimetype: string;
        }
      | undefined,
    @Body() meta: UploadTenantDocumentMetaDto,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Multipart field "file" is required',
      });
    }
    return this.docs.upload(current.userId, userId, file, meta);
  }

  @Delete('tenants/:userId/documents/:documentId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a tenant identity document' })
  async remove(
    @CurrentUser() current: AuthenticatedUser,
    @Param('userId') userId: string,
    @Param('documentId') documentId: string,
  ): Promise<void> {
    await this.docs.remove(current.userId, userId, documentId);
  }
}
