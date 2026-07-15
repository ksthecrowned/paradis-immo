import {
  BadRequestException,
  Body,
  Controller,
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
import {
  CurrentUser,
  OptionalUser,
} from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { ConfirmMediaDto, PresignMediaDto } from './dto/media.dto';
import { MediaService } from './media.service';

/**
 * Media upload flow:
 *
 *   Preferred (web): POST /properties/:id/media/upload — multipart via API → R2
 *   (no bucket CORS required).
 *
 *   Direct: POST …/presign then browser PUT to R2, then …/confirm
 *   (requires a correct R2 CORS policy).
 */
@ApiTags('Media')
@Controller('properties/:id/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @ApiOperation({ summary: 'List media for a property' })
  list(
    @Param('id') id: string,
    @OptionalUser() current: AuthenticatedUser | null,
  ) {
    return this.media.list(current?.userId ?? null, id);
  }

  @Post('presign')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a presigned R2 upload URL' })
  presign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PresignMediaDto,
  ) {
    return this.media.presign(current.userId, id, dto);
  }

  @Post('upload')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 15 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Upload media via API (proxied to R2 — no browser CORS)',
  })
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
    @Body('position') positionRaw?: string,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Multipart field "file" is required',
      });
    }
    const position =
      positionRaw === undefined || positionRaw === ''
        ? undefined
        : Number.parseInt(positionRaw, 10);
    return this.media.upload(
      current.userId,
      id,
      {
        buffer: file.buffer,
        originalname: file.originalname,
        mimetype: file.mimetype,
      },
      Number.isFinite(position) ? position : undefined,
    );
  }

  @Post('confirm')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm a media upload' })
  confirm(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmMediaDto,
  ) {
    return this.media.confirm(current.userId, id, dto);
  }
}
