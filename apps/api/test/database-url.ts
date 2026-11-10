import { config } from 'dotenv';

config({ path: ['.env', '../../.env'], quiet: true });

// e2e tests run on a separate "<db>_test" database, never on the dev data
export function testDatabaseUrl() {
  const url = new URL(
    process.env.DATABASE_URL ??
      'postgresql://epickem:epickem@localhost:5432/epickem',
  );
  if (!url.pathname.endsWith('_test')) url.pathname += '_test';
  return url.toString();
}
