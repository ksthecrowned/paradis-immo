import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { MediaType } from '@prisma/client';

export const R2_KEY = 'R2_SERVICE_CLIENT';

/** Allowed mime types for media uploads. */
const ALLOWED_CONTENT_TYPES: Record<string, MediaType> = {
  'image/jpeg': MediaType.PHOTO,
  'image/png': MediaType.PHOTO,
  'image/webp': MediaType.PHOTO,
  'image/heic': MediaType.PHOTO,
  'video/mp4': MediaType.VIDEO,
  'video/quicktime': MediaType.VIDEO,
};

const URL_TTL_SECONDS = 600;

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly accountId: string;

  constructor(@Inject(R2_KEY) client: S3Client) {
    this.client = client;
    this.bucket = process.env.R2_BUCKET ?? '';
    this.publicUrl = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
    this.accountId = process.env.R2_ACCOUNT_ID ?? '';
  }

  /**
   * Validate the content type against the allowed whitelist.
   * Returns the matching `MediaType` (PHOTO or VIDEO) so the caller can
   * persist the right enum value on the `PropertyMedia` row.
   */
  resolveMediaType(contentType: string): MediaType {
    const normalized = contentType.toLowerCase();
    const match = ALLOWED_CONTENT_TYPES[normalized];
    if (!match) {
      throw new MediaTypeError(
        `Unsupported content type "${contentType}". Allowed: ${Object.keys(ALLOWED_CONTENT_TYPES).join(', ')}`,
      );
    }
    return match;
  }

  /**
   * Build a presigned PUT URL the client uses to upload a single object
   * directly to Cloudflare R2. Returns the eventual public URL too.
   *
   * The object key follows the convention:
   *   properties/{propertyId}/{timestamp}-{random}-{filename}
   */
  async createPresignedUpload(params: {
    propertyId: string;
    filename: string;
    contentType: string;
  }): Promise<{
    uploadUrl: string;
    fileUrl: string;
    key: string;
    expiresIn: number;
  }> {
    if (!this.bucket || !this.publicUrl || !this.accountId) {
      throw new Error(
        'R2 is not configured (R2_BUCKET / R2_PUBLIC_URL / R2_ACCOUNT_ID missing)',
      );
    }
    const safeFilename = sanitizeFilename(params.filename);
    const key = `properties/${params.propertyId}/${Date.now()}-${randomToken(6)}-${safeFilename}`;
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: params.contentType,
    });
    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: URL_TTL_SECONDS,
    });
    return {
      uploadUrl,
      fileUrl: `${this.publicUrl}/${key}`,
      key,
      expiresIn: URL_TTL_SECONDS,
    };
  }

  /**
   * Check that a URL the client claims was just uploaded actually belongs to
   * our configured R2 public host. Prevents someone from pointing a
   * `PropertyMedia` row at a malicious URL.
   */
  validateFileUrl(url: string): void {
    if (!url.startsWith(`${this.publicUrl}/`)) {
      throw new UrlHostError(
        `URL must start with "${this.publicUrl}/" — got "${url}"`,
      );
    }
  }

  /**
   * Issue a presigned DELETE URL — useful for cleanup later. Not exposed yet
   * but kept here to avoid duplicating S3 plumbing when media deletion lands.
   */
  async createPresignedDelete(key: string): Promise<string> {
    const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn: URL_TTL_SECONDS });
  }

  /**
   * Server-side direct upload: PUT a Buffer straight to R2 and return the
   * public URL. Used for server-generated artifacts (receipt PDFs) where the
   * client doesn't upload anything itself.
   *
   * NOTE: this ONLY runs in environments where R2 is configured. Tests use a
   * fake injected via the `R2_KEY` token, so the bucket/public URL guards
   * here are skippable in the test harness.
   */
  async uploadBuffer(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ url: string }> {
    if (!this.bucket || !this.publicUrl) {
      throw new Error(
        'R2 is not configured (R2_BUCKET / R2_PUBLIC_URL missing) — cannot upload buffer',
      );
    }
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    });
    await this.client.send(command);
    return { url: `${this.publicUrl}/${key}` };
  }
}

export class MediaTypeError extends Error {}
export class UrlHostError extends Error {}

function sanitizeFilename(input: string): string {
  // Strip any path components the client may have included.
  const basename = input.replace(/\\/g, '/').split('/').pop() ?? 'file';
  return basename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function randomToken(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}
