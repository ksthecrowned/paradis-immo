import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  MeBuyerPaymentProofsController,
  SaleAgreementPaymentProofsController,
} from './buyer-payment-proofs.controller';
import { BuyerPaymentProofsService } from './buyer-payment-proofs.service';

describe('Buyer payment proofs HTTP', () => {
  let app: INestApplication;
  const proofs = {
    create: jest.fn(),
    latestForAgreement: jest.fn(),
    eligibility: jest.fn(),
    listForBuyer: jest.fn(),
    respond: jest.fn(),
  };

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    const moduleRef = await Test.createTestingModule({
      controllers: [
        SaleAgreementPaymentProofsController,
        MeBuyerPaymentProofsController,
      ],
      providers: [{ provide: BuyerPaymentProofsService, useValue: proofs }],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /sale-agreements/:id/payment-proofs → 201', async () => {
    proofs.create.mockResolvedValue({ id: 'proof-1', status: 'PENDING' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/sale-agreements/agr-1/payment-proofs')
      .set('x-test-user', 'manager-1')
      .expect(201);
    expect(proofs.create).toHaveBeenCalledWith('manager-1', 'agr-1');
    expect(res.body.id).toBe('proof-1');
  });

  it('GET /sale-agreements/:id/payment-proofs/latest', async () => {
    proofs.latestForAgreement.mockResolvedValue(null);
    await request(app.getHttpServer())
      .get('/api/v1/sale-agreements/agr-1/payment-proofs/latest')
      .set('x-test-user', 'manager-1')
      .expect(200);
    expect(proofs.latestForAgreement).toHaveBeenCalledWith(
      'manager-1',
      'agr-1',
    );
  });

  it('GET /sale-agreements/:id/payment-proofs/eligibility', async () => {
    proofs.eligibility.mockResolvedValue({
      eligible: false,
      reason: 'NO_PAID_PAYMENTS',
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/sale-agreements/agr-1/payment-proofs/eligibility')
      .set('x-test-user', 'manager-1')
      .expect(200);
    expect(res.body).toEqual({
      eligible: false,
      reason: 'NO_PAID_PAYMENTS',
    });
  });

  it('GET /me/buyer-payment-proofs', async () => {
    proofs.listForBuyer.mockResolvedValue([]);
    await request(app.getHttpServer())
      .get('/api/v1/me/buyer-payment-proofs')
      .set('x-test-user', 'buyer-1')
      .expect(200);
    expect(proofs.listForBuyer).toHaveBeenCalledWith('buyer-1');
  });

  it('POST /me/buyer-payment-proofs/:id/respond validates body', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/me/buyer-payment-proofs/proof-1/respond')
      .set('x-test-user', 'buyer-1')
      .send({})
      .expect(400);
    expect(proofs.respond).not.toHaveBeenCalled();
  });

  it('POST /me/buyer-payment-proofs/:id/respond → 200', async () => {
    proofs.respond.mockResolvedValue({ id: 'proof-1', status: 'GRANTED' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/me/buyer-payment-proofs/proof-1/respond')
      .set('x-test-user', 'buyer-1')
      .send({ accept: true })
      .expect(200);
    expect(proofs.respond).toHaveBeenCalledWith('buyer-1', 'proof-1', true);
    expect(res.body.status).toBe('GRANTED');
  });
});
