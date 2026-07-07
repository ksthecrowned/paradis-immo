import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
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
}
