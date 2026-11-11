import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { SignJWT, UnsecuredJWT } from 'jose';
import { ACCESS_TOKEN_TTL_SECONDS } from './auth.config.js';
import { TokenService } from './token.service.js';

const SECRET = 'unit-test-secret-at-least-32-characters';
const user = {
  id: '0190a7c0-1234-7abc-8def-0123456789ab',
  role: 'admin' as const,
};

describe('TokenService', () => {
  const tokens = new TokenService();

  beforeAll(() => {
    process.env.AUTH_SECRET = SECRET;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reads back the user from a token it signed', async () => {
    const token = await tokens.signAccessToken(user);
    await expect(tokens.verifyAccessToken(token)).resolves.toEqual(user);
  });

  it('rejects a token once it has expired', async () => {
    jest.useFakeTimers({ now: new Date('2026-11-11T10:00:00Z') });
    const token = await tokens.signAccessToken(user);
    jest.setSystemTime(
      new Date(
        Date.parse('2026-11-11T10:00:00Z') +
          (ACCESS_TOKEN_TTL_SECONDS + 1) * 1000,
      ),
    );
    await expect(tokens.verifyAccessToken(token)).resolves.toBeNull();
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode('another-secret-another-secret-123'));
    await expect(tokens.verifyAccessToken(forged)).resolves.toBeNull();
  });

  it('rejects an unsigned token ("alg": "none")', async () => {
    const unsigned = new UnsecuredJWT({ role: 'admin' })
      .setSubject(user.id)
      .setExpirationTime('15m')
      .encode();
    await expect(tokens.verifyAccessToken(unsigned)).resolves.toBeNull();
  });

  it('rejects a validly signed token with an unknown role', async () => {
    const odd = await new SignJWT({ role: 'superadmin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setExpirationTime('15m')
      .sign(new TextEncoder().encode(SECRET));
    await expect(tokens.verifyAccessToken(odd)).resolves.toBeNull();
  });

  it('rejects garbage', async () => {
    await expect(tokens.verifyAccessToken('not.a.jwt')).resolves.toBeNull();
  });

  it('creates unguessable refresh tokens and hashes them the same way every time', () => {
    const a = tokens.newRefreshToken();
    const b = tokens.newRefreshToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32 random bytes
    expect(tokens.hashRefreshToken(a)).toBe(tokens.hashRefreshToken(a));
    expect(tokens.hashRefreshToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(tokens.hashRefreshToken(a)).not.toContain(a);
  });
});
