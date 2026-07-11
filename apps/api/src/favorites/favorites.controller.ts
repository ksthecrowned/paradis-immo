import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppAuthGuard } from '../common/guards/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

class AddFavoriteDto {
  @IsString()
  propertyId!: string;
}

@ApiTags('Favorites')
@ApiBearerAuth()
@Controller('favorites')
@UseGuards(AppAuthGuard)
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's favorite properties" })
  list(@CurrentUser() current: AuthenticatedUser) {
    return this.favorites.list(current.userId);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a property to favorites' })
  add(@CurrentUser() current: AuthenticatedUser, @Body() dto: AddFavoriteDto) {
    return this.favorites.add(current.userId, dto.propertyId);
  }

  @Delete(':propertyId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a property from favorites' })
  async remove(
    @CurrentUser() current: AuthenticatedUser,
    @Param('propertyId') propertyId: string,
  ): Promise<void> {
    await this.favorites.remove(current.userId, propertyId);
  }
}
