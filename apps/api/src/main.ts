import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import 'dotenv/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');
  const allowedOrigins =
    process.env.NODE_ENV === 'production' && process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map((s) => s.trim())
      : process.env.NODE_ENV === 'production'
        ? [] // empty in prod without config = no CORS allowed
        : ['*'];

  app.enableCors({
    origin: allowedOrigins.length === 1 && allowedOrigins[0] === '*'
      ? '*'
      : (origin, callback) => {
          if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error('CORS: origin not allowed'));
          }
        },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle('Paradis Immo API')
    .setDescription('Hybrid real estate platform API — Congo (CG)')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Paradis Immo API running on http://localhost:${port}/api/v1`);
  console.log(`Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
