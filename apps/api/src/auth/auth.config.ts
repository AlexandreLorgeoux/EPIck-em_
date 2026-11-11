import { Logger } from '@nestjs/common';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

// Short-lived and stateless: a role change reaches the API within this delay
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
// Sliding: each refresh pushes the expiry back
export const REFRESH_TOKEN_TTL_DAYS = 7;

const EXAMPLE_SECRET = 'change-me';
let warned = false;

// Key used to sign access tokens. Read lazily so tests can set it.
export function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      'AUTH_SECRET is not set: generate one with `openssl rand -hex 32` and add it to .env',
    );
  }
  if (!warned && (secret === EXAMPLE_SECRET || secret.length < 32)) {
    warned = true;
    new Logger('Auth').warn(
      'AUTH_SECRET is weak (example value or under 32 characters): anyone who guesses it can forge sessions. Generate one with `openssl rand -hex 32` before deploying.',
    );
  }
  return new TextEncoder().encode(secret);
}

// Secure cookies are only sent over HTTPS (browsers accept them on localhost)
export const secureCookies = () =>
  process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
