import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/database-url.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    env: {
      DATABASE_URL: testDatabaseUrl(),
      AUTH_SECRET: 'e2e-test-secret-at-least-32-characters-long',
      // Tests sign in many times a minute; the rate-limit test lowers it
      AUTH_RATE_LIMIT: '1000',
    },
    // Test files share one database, so they run one after the other
    fileParallelism: false,
  },
});
