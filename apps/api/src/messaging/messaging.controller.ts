import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ConversationContext } from '@prisma/client';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { MessagingService } from './messaging.service';

class OpenConversationDto {
  @IsEnum(ConversationContext)
  contextType!: ConversationContext;

  @IsOptional()
  @IsString()
  contextId?: string;
}

class ListConversationsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20;
}

class ManagedConversationsQueryDto extends ListConversationsQueryDto {
  @IsOptional()
  @IsEnum(ConversationContext)
  contextType?: ConversationContext;

  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsOptional()
  @IsString()
  unread?: string;
}

class ListMessagesQueryDto {
  @IsOptional()
  @IsString()
  before?: string;

  @IsOptional()
  @IsString()
  after?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body?: string;

  @IsOptional()
  attachments?: Array<{
    fileKey: string;
    mimeType: string;
    size: number;
    name: string;
  }>;
}

export class MarkReadDto {
  @IsOptional()
  @IsString()
  messageId?: string;
}

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller()
@UseGuards(AppAuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Post('conversations')
  @ApiOperation({ summary: 'Open (or reuse) a conversation for a context (spec 10)' })
  open(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: OpenConversationDto,
  ) {
    return this.messaging.openConversation(current.userId, dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'My conversations with unread counts' })
  listMine(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.messaging.listMine(
      current.userId,
      query.page,
      query.pageSize,
    );
  }

  @Get('conversations/unread-count')
  @ApiOperation({ summary: 'Unread badge across my conversations' })
  unreadCount(@CurrentUser() current: AuthenticatedUser) {
    return this.messaging.badgeUnreadCount(current.userId);
  }

  @Get('conversations/managed')
  @ApiOperation({ summary: 'Agency shared inbox (operable properties)' })
  listManaged(
    @CurrentUser() current: AuthenticatedUser,
    @Query() query: ManagedConversationsQueryDto,
  ) {
    return this.messaging.listManaged(
      current.userId,
      {
        contextType: query.contextType,
        propertyId: query.propertyId,
        unreadOnly: query.unread === 'true',
      },
      query.page,
      query.pageSize,
    );
  }

  @Get('conversations/:id/messages')
  @ApiOperation({ summary: 'Paginated messages (?before&after&limit)' })
  listMessages(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Query() query: ListMessagesQueryDto,
  ) {
    return this.messaging.listMessages(current.userId, id, query);
  }

  @Post('conversations/:id/messages')
  @ApiOperation({ summary: 'Send a message (text and/or attachments)' })
  sendMessage(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.messaging.sendMessage(current.userId, id, dto);
  }

  @Post('conversations/:id/read')
  @ApiOperation({ summary: 'Mark the conversation read' })
  markRead(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: MarkReadDto,
  ) {
    return this.messaging.markRead(current.userId, id, dto.messageId);
  }

  @Delete('messages/:id')
  @ApiOperation({ summary: 'Delete my message inside the 5-minute window' })
  async deleteMessage(
    @CurrentUser() current: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.messaging.deleteMessage(current.userId, id);
  }
}
