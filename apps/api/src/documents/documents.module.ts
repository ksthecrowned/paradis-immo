import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentSequenceService } from './document-sequence.service';

/** Shared, per-organization yearly document numbering (spec 04). */
@Module({
  imports: [PrismaModule],
  providers: [DocumentSequenceService],
  exports: [DocumentSequenceService],
})
export class DocumentsModule {}
