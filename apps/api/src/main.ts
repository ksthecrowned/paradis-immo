import { RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import helmet from 'helmet';
import 'dotenv/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

function registerStdIoGuards() {
  const isIgnorableWriteError = (error: NodeJS.ErrnoException) =>
    (error?.code === 'EPIPE' || error?.code === 'EOF') &&
    (error?.syscall === 'write' || !error?.syscall);

  const handleStreamError = (error: NodeJS.ErrnoException) => {
    // On Windows + watch terminals, stdout/stderr can be closed unexpectedly.
    // Ignore these transport-level errors to avoid killing the API process.
    if (isIgnorableWriteError(error)) {
      return;
    }
    throw error;
  };

  process.on('uncaughtException', (error: unknown) => {
    const errnoError = error as NodeJS.ErrnoException;
    if (isIgnorableWriteError(errnoError)) {
      return;
    }
    throw error;
  });

  process.stdout.on('error', handleStreamError);
  process.stderr.on('error', handleStreamError);
}

async function bootstrap() {
  registerStdIoGuards();

  if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
    throw new Error(
      'JWT_SECRET environment variable is required in production',
    );
  }

  const app = await NestFactory.create(AppModule);

  app.use((req: Request, res: Response, next: () => void) => {
    const header = req.headers['x-request-id'];
    const fromHeader = Array.isArray(header) ? header[0] : header;
    const requestId = fromHeader?.trim() || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  app.use(helmet());

  const corsOriginEnv = process.env.ALLOWED_ORIGINS ?? '';
  const allowedOrigins = corsOriginEnv
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin:
      allowedOrigins.length > 0
        ? allowedOrigins
        : [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:8081',
            'http://127.0.0.1:8081',
          ],
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Idempotency-Key',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  app.setGlobalPrefix('api/v1', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Paradis Immo API')
    .setDescription('Hybrid real estate platform API — Congo (CG)')
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: "JWT d'authentification Paradis Immo",
      },
      'bearer',
    )
    .addServer('/api/v1')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, swaggerDocument, {
    customSiteTitle: 'Paradis Immo API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');
}

bootstrap();
