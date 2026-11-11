import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ACCESS_COOKIE } from '../src/auth/auth.config.js';
import { TokenService } from '../src/auth/token.service.js';
import type { UserRole } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Builds the real app with its real configuration (cookies, auth, validation)
export async function createTestApp() {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

// Creates an account with this role and returns a Cookie header carrying a
// real signed access token, as a browser would send after signing in
export async function signedInAs(app: INestApplication, role: UserRole) {
  const prisma = app.get(PrismaService);
  const user = await prisma.user.create({
    data: {
      email: `${role}-${crypto.randomUUID()}@example.test`,
      displayName: role,
      role,
    },
  });
  const token = await app.get(TokenService).signAccessToken(user);
  return { user, cookie: `${ACCESS_COOKIE}=${token}` };
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
