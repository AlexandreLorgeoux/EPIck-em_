import { defineConfig } from 'vitest/config';
import { testDatabaseUrl } from './test/database-url.js';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    globalSetup: ['./test/global-setup.ts'],
    env: { DATABASE_URL: testDatabaseUrl() },
    // Test files share one database, so they run one after the other
    fileParallelism: false,
  },
});
