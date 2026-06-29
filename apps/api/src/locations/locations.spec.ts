import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { LocationsModule } from './locations.module';

describe('Locations (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let brazzavilleId: string;
  let bzvArrId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [LocationsModule],
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

    const bzv = await prisma.city.findFirst({
      where: { name: 'Brazzaville' },
      include: { arrondissements: { take: 1 } },
    });
    if (!bzv) throw new Error('Run seed first (Brazzaville not found)');
    brazzavilleId = bzv.id;
    const arr = bzv.arrondissements[0];
    if (!arr) throw new Error('Brazzaville has no arrondissements');
    bzvArrId = arr.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.onModuleDestroy();
  });

  it('GET /locations/cities returns Brazzaville from seed', () => {
    return request(app.getHttpServer())
      .get('/api/v1/locations/cities')
      .expect(200)
      .expect((res) => {
        const names = (res.body as Array<{ name: string }>).map((c) => c.name);
        expect(names).toContain('Brazzaville');
        expect(names).toContain('Pointe-Noire');
      });
  });

  it('GET /locations/cities?countryCode=CG returns only CG cities', () => {
    return request(app.getHttpServer())
      .get('/api/v1/locations/cities?countryCode=CG')
      .expect(200)
      .expect((res) => {
        const body = res.body as Array<{
          name: string;
          country: { code: string };
        }>;
        expect(body.length).toBeGreaterThan(0);
        body.forEach((c) => expect(c.country.code).toBe('CG'));
      });
  });

  it('GET /locations/arrondissements?cityId=... returns the 9 BZV arrondissements', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/locations/arrondissements?cityId=${brazzavilleId}`)
      .expect(200)
      .expect((res) => {
        const body = res.body as Array<{ name: string; number: number }>;
        expect(body).toHaveLength(9);
        expect(body[0].name).toBe('Makélékélé');
        expect(body[0].number).toBe(1);
      });
  });

  it('GET /locations/arrondissements without cityId returns 400', () => {
    return request(app.getHttpServer())
      .get('/api/v1/locations/arrondissements')
      .expect(400);
  });

  it('GET /locations/quartiers?arrondissementId=... returns quartiers', () => {
    return request(app.getHttpServer())
      .get(`/api/v1/locations/quartiers?arrondissementId=${bzvArrId}`)
      .expect(200)
      .expect((res) => {
        const body = res.body as Array<{ name: string }>;
        expect(body.length).toBeGreaterThan(0);
        expect(body[0].name).toMatch(/Centre$/);
      });
  });

  it('GET /locations/quartiers without arrondissementId returns 400', () => {
    return request(app.getHttpServer())
      .get('/api/v1/locations/quartiers')
      .expect(400);
  });
});
