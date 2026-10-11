import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { R2Service } from './r2.service';

describe('R2Service private storage', () => {
  const originalPublicBucket = process.env.R2_BUCKET;
  const originalPrivateBucket = process.env.R2_PRIVATE_BUCKET;
  const client = {
    send: jest.fn(async (..._args: unknown[]) => undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.R2_BUCKET = 'public-assets';
    process.env.R2_PRIVATE_BUCKET = 'private-documents';
  });

  afterAll(() => {
    if (originalPublicBucket === undefined) delete process.env.R2_BUCKET;
    else process.env.R2_BUCKET = originalPublicBucket;
    if (originalPrivateBucket === undefined) {
      delete process.env.R2_PRIVATE_BUCKET;
    } else {
      process.env.R2_PRIVATE_BUCKET = originalPrivateBucket;
    }
  });

  it('uploads private property documents to the dedicated private bucket', async () => {
    const service = new R2Service(client as unknown as S3Client);

    await service.uploadPrivatePropertyFile({
      propertyId: 'property-1',
      filename: 'title.pdf',
      contentType: 'application/pdf',
      body: Buffer.from('%PDF'),
    });

    const command = client.send.mock.calls[0][0] as PutObjectCommand;
    expect(command.input.Bucket).toBe('private-documents');
    expect(command.input.Key).toContain('property-documents/property-1/');
  });

  it('rejects configuration that reuses the public bucket', async () => {
    process.env.R2_PRIVATE_BUCKET = 'public-assets';
    const service = new R2Service(client as unknown as S3Client);

    await expect(
      service.uploadPrivatePropertyFile({
        propertyId: 'property-1',
        filename: 'title.pdf',
        contentType: 'application/pdf',
        body: Buffer.from('%PDF'),
      }),
    ).rejects.toThrow('dedicated bucket');
    expect(client.send).not.toHaveBeenCalled();
  });
});
