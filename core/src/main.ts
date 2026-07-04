import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { Env } from './config/env.schema';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  // Reject unknown/invalid request payloads across every endpoint.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Run OnModuleDestroy hooks (e.g. draining the DB pool) on SIGTERM/SIGINT.
  app.enableShutdownHooks();

  const config = app.get(ConfigService<Env, true>);

  app.enableCors({
    origin: config
      .get('CORS_ORIGIN', { infer: true })
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  });

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  Logger.log(`Ballast core listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
