import { execFileSync } from 'node:child_process';
import { testDatabaseUrl } from './database-url.js';

// Creates the test database if needed and applies every migration
export default function setup() {
  execFileSync('../../node_modules/.bin/prisma', ['migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: 'pipe',
  });
}
