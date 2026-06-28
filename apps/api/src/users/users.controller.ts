import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UpdateMeDto } from './dto/update-me.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() current: AuthenticatedUser) {
    return this.users.getMe(current.userId);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: UpdateMeDto,
  ) {
    return this.users.updateMe(current.userId, dto);
  }

  @Get('me/organizations')
  async myOrganizations(@CurrentUser() current: AuthenticatedUser) {
    return this.users.listMyOrganizations(current.userId);
  }
}
