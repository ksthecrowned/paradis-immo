/**
 * Upload seed listing photos from apps/mobile/assets/images to Cloudflare R2.
 *
 * Stable keys: seed/houses/house{1-6}.jpg
 * Public URLs: ${R2_PUBLIC_URL}/seed/houses/houseN.jpg
 *
 * Usage (from apps/api):
 *   bun run scripts/upload-seed-images.ts
 */
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PutObjectCommand, S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID?.trim();
const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
const bucket = process.env.R2_BUCKET?.trim();
const publicUrl = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

const missing: string[] = [];
if (!accountId) missing.push('R2_ACCOUNT_ID');
if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
if (!bucket) missing.push('R2_BUCKET');
if (!publicUrl) missing.push('R2_PUBLIC_URL');

if (missing.length > 0) {
  console.error(`Missing R2 env: ${missing.join(', ')}`);
  process.exit(1);
}

const IMAGES_DIR = resolve(
  __dirname,
  '../../mobile/assets/images',
);

const HOUSE_FILES = [
  'house1.jpg',
  'house2.jpg',
  'house3.jpg',
  'house4.jpg',
  'house5.jpg',
  'house6.jpg',
] as const;

function contentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function objectExists(
  client: S3Client,
  key: string,
): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const available = new Set(readdirSync(IMAGES_DIR));
  const missingFiles = HOUSE_FILES.filter((f) => !available.has(f));
  if (missingFiles.length > 0) {
    console.error(`Missing files in ${IMAGES_DIR}: ${missingFiles.join(', ')}`);
    process.exit(1);
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
    },
  });

  const force = process.argv.includes('--force');
  const uploaded: Array<{ file: string; key: string; url: string }> = [];

  for (const file of HOUSE_FILES) {
    const key = `seed/houses/${file}`;
    const url = `${publicUrl}/${key}`;
    const exists = await objectExists(client, key);
    if (exists && !force) {
      console.log(`⏭  skip (exists) ${key}`);
      uploaded.push({ file, key, url });
      continue;
    }
    const body = readFileSync(join(IMAGES_DIR, file));
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType(file),
      }),
    );
    console.log(`✓ uploaded ${key} (${body.length} bytes)`);
    uploaded.push({ file, key, url });
  }

  console.log('\nPublic URLs:');
  for (const row of uploaded) {
    console.log(`  ${row.file} → ${row.url}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
