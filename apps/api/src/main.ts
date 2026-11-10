import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

// Local dev reads the repo-root .env; in Docker/CI the variables are injected
config({ path: ['.env', '../../.env'], quiet: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(process.env.API_PORT ?? 4000);
}
await bootstrap();
