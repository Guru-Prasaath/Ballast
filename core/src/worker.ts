import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerAppModule } from './worker/worker-app.module';

/**
 * Worker process entrypoint. Run several of these alongside the API to form a
 * fleet. `enableShutdownHooks` wires SIGTERM to the WorkerService's graceful
 * drain.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    bufferLogs: false,
  });
  app.enableShutdownHooks();
  Logger.log('Ballast worker started', 'Bootstrap');
}

void bootstrap();
