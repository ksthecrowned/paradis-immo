import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';
import { R2Service, R2_KEY, MediaTypeError, UrlHostError } from './r2.service';

describe('Media (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerUserId: string;
  let outsiderUserId: string;
  let countryId: string;
  let bzvQuartierId: string;
  let propertyId: string;
  let organizationId: string;
  const createdMediaIds: string[] = [];
  let fakeR2: {
    resolveMediaType: jest.Mock;
    createPresignedUpload: jest.Mock;
    validateFileUrl: jest.Mock;
    createPresignedDelete: jest.Mock;
    uploadPropertyFile: jest.Mock;
  };

  beforeAll(async () => {
    // Provide R2 env so R2Service can construct the client
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
    process.env.R2_BUCKET = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com';

    fakeR2 = {
      resolveMediaType: jest.fn(),
      createPresignedUpload: jest.fn(),
      validateFileUrl: jest.fn(),
      createPresignedDelete: jest.fn(),
      uploadPropertyFile: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      controllers: [MediaController],
      providers: [
        MediaService,

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        { provide: R2Service, useValue: fakeR2 as any },
        { provide: R2_KEY, useValue: {} },
        PrismaService,
      ],
    })
      .overrideProvider(EventPublisher)
      .useValue({ emit: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const country =
      (await prisma.country.findUnique({ where: { code: 'CG' } })) ??
      (await prisma.country.create({
        data: {
          code: 'CG',
          name: 'Congo',
          currency: 'XAF',
          phonePrefix: '+242',
          activeProviders: ['AIRTEL'],
        },
      }));
    countryId = country.id;

    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    await prisma.user.deleteMany({
      where: { phone: { in: ['+242076666666', '+242077777777'] } },
    });
    const owner = await prisma.user.create({
      data: {
        phone: '+242076666666',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const outsider = await prisma.user.create({
      data: {
        phone: '+242077777777',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    outsiderUserId = outsider.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Media Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    organizationId = ownerOrg.id;
    const property = await prisma.property.create({
      data: {
        title: 'Bien avec média',
        description: 'Pour tester les uploads',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    propertyId = property.id;

    // Wire the fake R2 service to mirror what the real one does.
    fakeR2.resolveMediaType.mockImplementation((ct: string) => {
      if (
        ['image/jpeg', 'image/png', 'image/webp', 'image/heic'].includes(ct)
      ) {
        return 'PHOTO';
      }
      if (['video/mp4', 'video/quicktime'].includes(ct)) {
        return 'VIDEO';
      }
      throw new MediaTypeError(`Unsupported content type "${ct}"`);
    });
    fakeR2.createPresignedUpload.mockImplementation(
      (p: { propertyId: string; filename: string; contentType: string }) => ({
        uploadUrl: 'https://r2.example.com/upload?sig=abc',
        fileUrl: `https://cdn.example.com/properties/${p.propertyId}/${p.filename}`,
        key: `properties/${p.propertyId}/${p.filename}`,
        expiresIn: 600,
      }),
    );
    fakeR2.validateFileUrl.mockImplementation((url: string) => {
      if (!url.startsWith('https://cdn.example.com/')) {
        throw new UrlHostError(
          `URL must start with "https://cdn.example.com/" — got "${url}"`,
        );
      }
    });
    fakeR2.uploadPropertyFile.mockImplementation(
      (p: { propertyId: string; filename: string }) => ({
        url: `https://cdn.example.com/properties/${p.propertyId}/${p.filename}`,
        key: `properties/${p.propertyId}/${p.filename}`,
      }),
    );
  });

  afterAll(async () => {
    if (createdMediaIds.length) {
      await prisma.propertyMedia.deleteMany({
        where: { id: { in: createdMediaIds } },
      });
    }
    if (propertyId) {
      await prisma.property
        .delete({ where: { id: propertyId } })
        .catch(() => undefined);
    }
    if (organizationId) {
      await prisma.organizationMember
        .deleteMany({ where: { organizationId } })
        .catch(() => undefined);
      await prisma.organization
        .delete({ where: { id: organizationId } })
        .catch(() => undefined);
    }
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, outsiderUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, outsiderUserId] } },
    });
    await app.close();
    await prisma.onModuleDestroy();
  });

  it('POST /properties/:id/media/presign returns uploadUrl and fileUrl', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/media/presign`)
      .set('x-test-user', ownerUserId)
      .send({
        filename: 'photo-1.jpg',
        contentType: 'image/jpeg',
        type: 'PHOTO',
      })
      .expect(201);

    const body = res.body as {
      uploadUrl: string;
      fileUrl: string;
      key: string;
      expiresIn: number;
    };
    expect(body.uploadUrl).toMatch(/^https:\/\//);
    expect(body.fileUrl).toMatch(/^https:\/\/cdn\.example\.com\//);
    expect(body.key).toMatch(/^properties\//);
    expect(body.key).toMatch(/\.jpg$/);
    expect(body.expiresIn).toBe(600);
  });

  it('POST /properties/:id/media/confirm creates a PropertyMedia row', async () => {
    const fileUrl = `https://cdn.example.com/properties/test-${Date.now()}.jpg`;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/media/confirm`)
      .set('x-test-user', ownerUserId)
      .send({ url: fileUrl, type: 'PHOTO', position: 0 })
      .expect(201);

    const body = res.body as {
      id: string;
      url: string;
      type: string;
      propertyId: string;
      position: number;
    };
    expect(body.id).toBeDefined();
    expect(body.url).toBe(fileUrl);
    expect(body.type).toBe('PHOTO');
    expect(body.propertyId).toBe(propertyId);
    createdMediaIds.push(body.id);
  });

  it('presign rejects invalid contentType (R2Service throws MediaTypeError)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/media/presign`)
      .set('x-test-user', ownerUserId)
      .send({
        filename: 'virus.exe',
        contentType: 'application/x-msdownload',
        type: 'PHOTO',
      })
      .expect(400);
  });

  it('confirm rejects url outside the configured public R2 host', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/media/confirm`)
      .set('x-test-user', ownerUserId)
      .send({
        url: 'https://evil.example.com/steal.jpg',
        type: 'PHOTO',
        position: 1,
      })
      .expect(400);
  });

  it('presign rejects non-owner (403)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/media/presign`)
      .set('x-test-user', outsiderUserId)
      .send({
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        type: 'PHOTO',
      })
      .expect(403);
  });

  it('presign rejects unauthenticated request (401)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/media/presign`)
      .send({
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
        type: 'PHOTO',
      })
      .expect(401);
  });

  it('GET /properties/:id/media lists the attached media', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/media`)
      .expect(200);
    const body = res.body as Array<{ propertyId: string; type: string }>;
    expect(body.length).toBeGreaterThan(0);
    body.forEach((m) => expect(m.propertyId).toBe(propertyId));
  });

  it('rejects PHOTO larger than 15 Mo', async () => {
    const big = Buffer.alloc(15 * 1024 * 1024 + 1, 0);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/media/upload`)
      .set('x-test-user', ownerUserId)
      .attach('file', big, { filename: 'big.jpg', contentType: 'image/jpeg' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
    expect(res.body.message).toBe('La photo ne doit pas dépasser 15 Mo.');
    expect(fakeR2.uploadPropertyFile).not.toHaveBeenCalled();
  });

  it('rejects VIDEO larger than 20 Mo', async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1, 0);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/media/upload`)
      .set('x-test-user', ownerUserId)
      .attach('file', big, { filename: 'big.mp4', contentType: 'video/mp4' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('FILE_TOO_LARGE');
    expect(res.body.message).toBe('La vidéo ne doit pas dépasser 20 Mo.');
    expect(fakeR2.uploadPropertyFile).not.toHaveBeenCalled();
  });

  it('accepts a small VIDEO upload', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/media/upload`)
      .set('x-test-user', ownerUserId)
      .attach('file', Buffer.from('fake-mp4'), {
        filename: 'clip.mp4',
        contentType: 'video/mp4',
      })
      .expect(201);

    const body = res.body as { id: string; type: string; propertyId: string };
    expect(body.type).toBe('VIDEO');
    expect(body.propertyId).toBe(propertyId);
    createdMediaIds.push(body.id);
  });
});
