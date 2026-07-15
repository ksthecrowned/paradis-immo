import { Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { R2Service, R2_KEY } from './r2.service';

/**
 * Factory that wires the `R2Service` with an `S3Client` pointed at our
 * Cloudflare R2 endpoint. Reads config from env vars set at app boot.
 *
 * Done in a factory so tests can override `R2_KEY` with a fake client.
 */
function makeR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'R2 client is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.',
    );
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    // AWS SDK v3 adds CRC32 checksum query params by default; those break
    // browser PUT uploads to R2 (CORS preflight + signature mismatch).
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

@Module({
  imports: [PrismaModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    R2Service,
    {
      provide: R2_KEY,
      useFactory: makeR2Client,
    },
  ],
  exports: [R2Service],
})
export class MediaModule {}
