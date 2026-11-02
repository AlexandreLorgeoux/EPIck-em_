import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Local dev reads the repo-root .env; in Docker/CI the variables are injected
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Not required by `prisma generate`, so the image builds without a database
    url: process.env.DATABASE_URL ?? '',
  },
});
