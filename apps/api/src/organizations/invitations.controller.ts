import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AgencyService } from './agency.service';

class ReplyReviewDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  reply!: string;
}

/**
 * Invitation landing routes (spec 02). The preview is public so the invitee
 * can see which agency and which role before signing in.
 */
@ApiTags('Invitations')
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly agency: AgencyService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Preview an invitation (public) — spec 02' })
  preview(@Param('token') token: string) {
    return this.agency.previewInvitation(token);
  }

  @Post(':token/accept')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Accept an invitation — spec 02' })
  accept(@CurrentUser() me: AuthenticatedUser, @Param('token') token: string) {
    return this.agency.acceptInvitation(me.userId, token);
  }

  @Post(':token/decline')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Decline an invitation — spec 02' })
  decline(@CurrentUser() me: AuthenticatedUser, @Param('token') token: string) {
    return this.agency.declineInvitation(me.userId, token);
  }
}

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly agency: AgencyService) {}

  @Post(':reviewId/reply')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Publicly reply to a review — spec 02' })
  reply(
    @CurrentUser() me: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
    @Body() dto: ReplyReviewDto,
  ) {
    return this.agency.replyToReview(me.userId, reviewId, dto.reply);
  }

  @Post(':reviewId/flag')
  @UseGuards(AppAuthGuard)
  @HttpCode(200)
  @ApiOperation({ summary: 'Flag a review for moderation — spec 02' })
  flag(
    @CurrentUser() me: AuthenticatedUser,
    @Param('reviewId') reviewId: string,
  ) {
    return this.agency.flagReview(me.userId, reviewId);
  }
}

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('users/me')
export class ReviewEligibilityController {
  constructor(private readonly agency: AgencyService) {}

  @Get('review-eligibility')
  @UseGuards(AppAuthGuard)
  @ApiOperation({ summary: 'Interactions I can still rate — spec 02' })
  async eligibility(@CurrentUser() me: AuthenticatedUser) {
    const items = await this.agency.reviewEligibility(me.userId);
    return { items };
  }
}
