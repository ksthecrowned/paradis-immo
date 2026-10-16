import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MandatesModule } from '../mandates/mandates.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuthModule, MandatesModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
