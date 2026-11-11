import { beforeAll, describe, expect, it } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';
import { ACCESS_COOKIE } from './auth.config.js';
import { authenticate } from './authenticate.middleware.js';
import { TokenService } from './token.service.js';

const run = async (cookies?: Record<string, string>) => {
  const req = { cookies } as Request & { user?: unknown };
  let called = false;
  const next: NextFunction = () => {
    called = true;
  };
  await authenticate(new TokenService())(req, {} as Response, next);
  return { user: req.user, called };
};

describe('authenticate middleware', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = 'unit-test-secret-at-least-32-characters';
  });

  it('sets request.user from a valid access-token cookie', async () => {
    const user = {
      id: '0190a7c0-1234-7abc-8def-0123456789ab',
      role: 'player' as const,
    };
    const token = await new TokenService().signAccessToken(user);
    await expect(run({ [ACCESS_COOKIE]: token })).resolves.toEqual({
      user,
      called: true,
    });
  });

  it('leaves request.user empty without a cookie or with a bad one, and carries on', async () => {
    await expect(run()).resolves.toEqual({ user: undefined, called: true });
    await expect(run({ [ACCESS_COOKIE]: 'tampered' })).resolves.toEqual({
      user: undefined,
      called: true,
    });
  });
});
