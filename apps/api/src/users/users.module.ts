import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MandatesModule } from '../mandates/mandates.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AccountDeletionProcessor } from './account-deletion.processor';

@Module({
  imports: [AuthModule, MandatesModule],
  controllers: [UsersController],
  providers: [UsersService, AccountDeletionProcessor],
  exports: [UsersService],
})
export class UsersModule {}
