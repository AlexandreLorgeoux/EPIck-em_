import { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-app.js';

describe('AppModule (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('boots', () => {
    expect(app).toBeDefined();
  });
});
