import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureHttp } from './bootstrap/http.js';
import { configureLogger } from './bootstrap/logger.js';
import { configureOpenApi } from './bootstrap/openapi.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: configureLogger(process.env.LOG_LEVEL) });
  const config = app.get(ConfigService);
  configureHttp(app);
  configureOpenApi(app);
  await app.listen(config.get<number>('PORT')!);
}

// A failed start (Mongo, a port in use) ends the process, so the container restarts instead of hanging.
bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').fatal(error instanceof Error ? (error.stack ?? error.message) : String(error));
  process.exit(1);
});
