import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventPublisher } from './event.publisher';

@Global()
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [EventPublisher],
  exports: [EventPublisher],
})
export class EventModule {}
