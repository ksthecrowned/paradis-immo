import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MandatesModule } from '../mandates/mandates.module';
import { EventModule } from '../events/event.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [PrismaModule, MandatesModule, EventModule],
  controllers: [MessagingController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
