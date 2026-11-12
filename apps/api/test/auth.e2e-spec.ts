import { INestApplication } from '@nestjs/common';
import { SignJWT } from 'jose';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../src/auth/auth.config.js';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { createTestApp, resetDatabase, signedInAs } from './test-app.js';

const UNKNOWN_ID = '0190a7c0-0000-7000-8000-000000000000';
const PASSWORD = 'correct horse battery';

// Set-Cookie headers of a response, by cookie name
const setCookies = (res: request.Response) => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return Object.fromEntries(
    (raw ?? []).map((c) => [c.slice(0, c.indexOf('=')), c]),
  );
};

describe('Authentication and roles (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const server = () => app.getHttpServer();
  const register = (body: object, agent = request(server())) =>
    agent.post('/auth/register').send(body);
  const account = (email = 'zywoo@example.test') => ({
    email,
    displayName: 'Zywoo',
    password: PASSWORD,
  });

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('registration', () => {
    it('creates a plain user and signs them in with httpOnly cookies', async () => {
      const res = await register(account()).expect(201);

      expect(res.body).toEqual({
        id: expect.any(String),
        email: 'zywoo@example.test',
        displayName: 'Zywoo',
        role: 'user',
        createdAt: expect.any(String),
      });
      const cookies = setCookies(res);
      for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
        expect(cookies[name]).toMatch(/HttpOnly/);
        expect(cookies[name]).toMatch(/SameSite=Lax/);
        expect(cookies[name]).toMatch(/Path=\//);
      }
    });

    it('stores an argon2id hash, never the password', async () => {
      await register(account()).expect(201);
      const user = await prisma.user.findUniqueOrThrow({
        where: { email: 'zywoo@example.test' },
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(PASSWORD);
    });

    it('normalizes the email so the same address cannot register twice', async () => {
      await register(account('  Zywoo@Example.TEST ')).expect(201);
      const res = await register(account('zywoo@example.test')).expect(409);
      expect(res.body.message).toBe(
        'An account already uses this email: sign in instead',
      );
    });

    it('does not let anyone choose their role', async () => {
      const res = await register({ ...account(), role: 'admin' }).expect(400);
      expect(res.body.message).toContain('property role should not exist');
    });

    it('explains what is wrong with invalid input', async () => {
      const res = await register({
        email: 'not-an-email',
        displayName: 'Z',
        password: 'short',
      }).expect(400);
      expect(res.body.errors).toEqual({
        email: ['email must be a valid email address'],
        displayName: ['displayName must be between 2 and 32 characters'],
        password: ['password must be between 8 and 128 characters'],
      });
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'email must be a valid email address',
          'displayName must be between 2 and 32 characters',
          'password must be between 8 and 128 characters',
        ]),
      );
    });
  });

  describe('login and current user', () => {
    beforeEach(async () => {
      await register(account()).expect(201);
    });

    it('signs in and then knows who the user is', async () => {
      const agent = request.agent(server());
      await agent
        .post('/auth/login')
        .send({ email: 'ZYWOO@example.test', password: PASSWORD })
        .expect(200);
      const me = await agent.get('/auth/me').expect(200);
      expect(me.body).toMatchObject({
        email: 'zywoo@example.test',
        role: 'user',
      });
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const wrongPassword = await request(server())
        .post('/auth/login')
        .send({ email: 'zywoo@example.test', password: 'not the password' })
        .expect(401);
      const unknownEmail = await request(server())
        .post('/auth/login')
        .send({ email: 'nobody@example.test', password: PASSWORD })
        .expect(401);
      expect(wrongPassword.body.message).toBe('Invalid email or password');
      expect(unknownEmail.body.message).toBe('Invalid email or password');
    });

    it('rejects anonymous visitors and forged tokens', async () => {
      await request(server()).get('/auth/me').expect(401);
      const forged = await new SignJWT({ role: 'admin' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(UNKNOWN_ID)
        .setExpirationTime('15m')
        .sign(new TextEncoder().encode('a-secret-the-server-does-not-know'));
      await request(server())
        .get('/auth/me')
        .set('Cookie', `${ACCESS_COOKIE}=${forged}`)
        .expect(401);
    });
  });

  describe('refresh and logout', () => {
    it('swaps the refresh token on each refresh and refuses the old one', async () => {
      const first = await register(account()).expect(201);
      const oldRefresh = setCookies(first)[REFRESH_COOKIE].split(';')[0];

      const refreshed = await request(server())
        .post('/auth/refresh')
        .set('Cookie', oldRefresh)
        .expect(200);
      expect(refreshed.body.email).toBe('zywoo@example.test');
      expect(setCookies(refreshed)[REFRESH_COOKIE].split(';')[0]).not.toBe(
        oldRefresh,
      );

      const reused = await request(server())
        .post('/auth/refresh')
        .set('Cookie', oldRefresh)
        .expect(401);
      expect(reused.body.message).toBe(
        'Your session has expired: sign in again',
      );
      // The failed refresh also clears the cookies
      expect(setCookies(reused)[ACCESS_COOKIE]).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
    });

    it('answers 401 without a refresh cookie', async () => {
      await request(server()).post('/auth/refresh').expect(401);
    });

    it('signs out: the session cannot be refreshed any more', async () => {
      const signedIn = await register(account()).expect(201);
      const refresh = setCookies(signedIn)[REFRESH_COOKIE].split(';')[0];

      const res = await request(server())
        .post('/auth/logout')
        .set('Cookie', refresh)
        .expect(204);
      expect(setCookies(res)[REFRESH_COOKIE]).toMatch(
        /Expires=Thu, 01 Jan 1970/,
      );
      // Replaying the token, as someone who copied the cookie would
      await request(server())
        .post('/auth/refresh')
        .set('Cookie', refresh)
        .expect(401);
      const session = await prisma.session.findFirstOrThrow();
      expect(session.revokedAt).not.toBeNull();
    });
  });

  describe('roles', () => {
    let admin: Awaited<ReturnType<typeof signedInAs>>;

    beforeEach(async () => {
      admin = await signedInAs(app, 'admin');
    });

    const routes: [method: 'get' | 'patch', url: string][] = [
      ['get', '/users'],
      ['patch', `/users/${UNKNOWN_ID}/role`],
    ];

    it.each(routes)(
      '%s %s rejects anonymous visitors with 401',
      async (method, url) => {
        await request(server())[method](url).expect(401);
      },
    );

    it.each(routes)(
      '%s %s rejects plain users and players with 403',
      async (method, url) => {
        for (const role of ['user', 'player'] as const) {
          const { cookie } = await signedInAs(app, role);
          await request(server())
            [method](url)
            .set('Cookie', cookie)
            .expect(403);
        }
      },
    );

    it('lists users without their password hash', async () => {
      await register(account()).expect(201);
      const res = await request(server())
        .get('/users')
        .set('Cookie', admin.cookie)
        .expect(200);
      expect(res.body).toHaveLength(2);
      for (const user of res.body)
        expect(user).not.toHaveProperty('passwordHash');
    });

    it('lets an admin make someone a player, which signs them out', async () => {
      const agent = request.agent(server());
      const { body: user } = await register(account(), agent).expect(201);

      const res = await request(server())
        .patch(`/users/${user.id}/role`)
        .set('Cookie', admin.cookie)
        .send({ role: 'player' })
        .expect(200);
      expect(res.body.role).toBe('player');

      // The old session carried the user role: it must sign in again
      await agent.post('/auth/refresh').expect(401);
      const login = request.agent(server());
      await login
        .post('/auth/login')
        .send({ email: user.email, password: PASSWORD })
        .expect(200);
      const me = await login.get('/auth/me').expect(200);
      expect(me.body.role).toBe('player');
    });

    it('does not let an admin change their own role', async () => {
      const res = await request(server())
        .patch(`/users/${admin.user.id}/role`)
        .set('Cookie', admin.cookie)
        .send({ role: 'user' })
        .expect(400);
      expect(res.body.message).toBe(
        'You cannot change your own role: ask another admin',
      );
    });

    it('explains an unknown role and an unknown user', async () => {
      const bad = await request(server())
        .patch(`/users/${UNKNOWN_ID}/role`)
        .set('Cookie', admin.cookie)
        .send({ role: 'superadmin' })
        .expect(400);
      expect(bad.body.message).toEqual([
        'role must be one of: admin, player, user',
      ]);
      await request(server())
        .patch(`/users/${UNKNOWN_ID}/role`)
        .set('Cookie', admin.cookie)
        .send({ role: 'player' })
        .expect(404);
    });
  });
});

describe('Login rate limit (e2e)', () => {
  let app: INestApplication<App>;
  const previous = process.env.AUTH_RATE_LIMIT;

  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT = '3';
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    process.env.AUTH_RATE_LIMIT = previous;
    await app.close();
  });

  it('answers 429 after too many attempts in a minute', async () => {
    const attempt = () =>
      request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'nobody@example.test', password: 'whatever' });
    for (let i = 0; i < 3; i++) await attempt().expect(401);
    await attempt().expect(429);
  });
});

describe('First admin account (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    process.env.ADMIN_EMAIL = 'Admin@Example.test';
    process.env.ADMIN_PASSWORD = 'a long admin password';
    const setup = await createTestApp();
    await resetDatabase(setup.prisma);
    await setup.app.close();
    // A fresh start on an empty database creates the admin
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    await app.close();
  });

  it('creates the admin from ADMIN_EMAIL and ADMIN_PASSWORD, who can sign in', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent
      .post('/auth/login')
      .send({ email: 'admin@example.test', password: 'a long admin password' })
      .expect(200);
    const me = await agent.get('/auth/me').expect(200);
    expect(me.body.role).toBe('admin');
  });
});
