import { config } from 'dotenv';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { seedDemoTournament } from './demo.js';

// npm run db:seed -w apps/api: fills the database pointed to by
// DATABASE_URL with the demo tournament (see demo.ts)
config({ path: ['.env', '../../.env'], quiet: true });

const app = await NestFactory.createApplicationContext(AppModule, {
  logger: ['error', 'warn'],
});
try {
  const summary = await seedDemoTournament(app);
  console.log(
    summary.created
      ? `Demo tournament /tournaments/${summary.slug}: ${summary.users} users, ${summary.predictions} predictions, ${summary.results} results`
      : `Demo tournament /tournaments/${summary.slug} already exists: nothing to do`,
  );
} finally {
  await app.close();
}
