import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

export const ROLE_HEADER = 'x-test-role';

// Builds the real app, plus a test-only stand-in for the session layer
// (ticket #9): the role sent in the x-test-role header becomes request.user
export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const role = req.header(ROLE_HEADER);
    if (role) {
      (req as Request & { user?: unknown }).user = { id: `test-${role}`, role };
    }
    next();
  });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

// Empties every table between tests. TRUNCATE skips the row triggers that
// make results append-only, which is what a reset needs.
export async function resetDatabase(prisma: PrismaService) {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`,
  );
}
