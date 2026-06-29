import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CurrentUser,
  OptionalUser,
} from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { ConfirmMediaDto, PresignMediaDto } from './dto/media.dto';
import { MediaService } from './media.service';

/**
 * Two-step media upload flow:
 *
 *   1. POST /properties/:id/media/presign  → returns a presigned PUT URL the
 *      browser uses to upload directly to Cloudflare R2.
 *   2. POST /properties/:id/media/confirm  → persists a `PropertyMedia` row
 *      pointing at the file URL returned by R2.
 *
 * Why split it: R2 (S3-compatible) is reached directly by the browser
 * without our API proxying the bytes. The API only handles auth and metadata.
 */
@Controller('properties/:id/media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  list(
    @Param('id') id: string,
    @OptionalUser() current: AuthenticatedUser | null,
  ) {
    return this.media.list(current?.userId ?? null, id);
  }

  @Post('presign')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  presign(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PresignMediaDto,
  ) {
    return this.media.presign(current.userId, id, dto);
  }

  @Post('confirm')
  @UseGuards(AppAuthGuard)
  @HttpCode(201)
  confirm(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ConfirmMediaDto,
  ) {
    return this.media.confirm(current.userId, id, dto);
  }
}
