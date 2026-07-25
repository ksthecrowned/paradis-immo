import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

class LookupUserQueryDto {
  @IsString()
  @Matches(/^\+\d{7,15}$/, {
    message: 'phone must be E.164 (+country…)',
  })
  phone!: string;
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(AppAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user profile' })
  async getMe(@CurrentUser() current: AuthenticatedUser) {
    return this.users.getMe(current.userId);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update authenticated user profile' })
  async updateMe(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ) {
    return this.users.updateMe(current.userId, dto);
  }

  @Get('me/organizations')
  @ApiOperation({ summary: 'List organizations the user belongs to' })
  async myOrganizations(@CurrentUser() current: AuthenticatedUser) {
    return this.users.listMyOrganizations(current.userId);
  }

  @Get('lookup')
  @ApiOperation({
    summary: 'Lookup a registered user by E.164 phone (owner/agent flows)',
  })
  async lookup(@Query() query: LookupUserQueryDto) {
    return this.users.lookupByPhone(query.phone);
  }
}
