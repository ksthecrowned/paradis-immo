/**
 * Export the live NestJS OpenAPI document to `apps/api/openapi.json`.
 *
 * Boots the application in-process — no HTTP listener — feeds it the
 * same `DocumentBuilder` config used by `main.ts`, and writes the
 * resulting JSON to disk so the codegen pipeline (and CI) can read
 * it without spinning up a server.
 *
 * Usage: `pnpm --filter api export:openapi`
 */
import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { writeFileSync, appendFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

// `dotenv/config` is called above, but in some pnpm/hoisted layouts it
// resolves the .env from CWD rather than this file's directory. Make
// the lookup explicit so the script behaves the same whether invoked
// from the repo root or from apps/api.
loadEnv({ path: resolve(__dirname, '..', '.env') });

// R2 credentials are not required for OpenAPI export (the client is
// never used — we only inspect controller metadata). Stub them so the
// MediaModule factory doesn't refuse to instantiate. These values
// are placeholders and never reach the network.
if (!process.env.R2_ACCOUNT_ID) {
  process.env.R2_ACCOUNT_ID = 'openapi-export-stub';
  process.env.R2_ACCESS_KEY_ID = 'openapi-export-stub';
  process.env.R2_SECRET_ACCESS_KEY = 'openapi-export-stub';
}

const LOG_PATH = resolve(__dirname, '..', 'openapi-export.log');
function logStep(msg: string): void {
  console.log(msg);
  appendFileSync(LOG_PATH, `${new Date().toISOString()} ${msg}\n`, 'utf-8');
}

async function exportOpenApi(): Promise<void> {
  logStep('export:openapi: starting');
  logStep(`env DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'unset'}`);
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  logStep('NestFactory.create ok');
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Paradis Immo API')
    .setDescription(
      'Hybrid real estate platform API — Congo (CG). Generated snapshot.',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  logStep(
    `SwaggerModule.createDocument ok, paths=${Object.keys(document.paths ?? {}).length}`,
  );

  const out = join(__dirname, '..', 'openapi.json');
  writeFileSync(out, JSON.stringify(document, null, 2), 'utf-8');
  logStep(`OpenAPI snapshot written to ${out}`);

  await app.close();
  logStep('export:openapi: done');
}

exportOpenApi().catch((err: unknown) => {
  console.error('export:openapi failed', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('unhandledRejection in export:openapi', reason);
  process.exit(1);
});
