import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { UserRole } from '../generated/prisma/enums.js';
import { ACCESS_TOKEN_TTL_SECONDS, authSecret } from './auth.config.js';
import type { AuthUser } from './auth-user.js';

const ROLES: readonly string[] = ['admin', 'player', 'spectator'];

@Injectable()
export class TokenService {
  // Access token: a signed JWT carrying the user id and role
  signAccessToken(user: AuthUser) {
    return new SignJWT({ role: user.role })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
      .sign(authSecret());
  }

  // Null for anything that is not a valid, unexpired token we signed
  async verifyAccessToken(token: string): Promise<AuthUser | null> {
    try {
      const { payload } = await jwtVerify(token, authSecret(), {
        algorithms: ['HS256'],
      });
      if (!payload.sub || !ROLES.includes(payload.role as string)) return null;
      return { id: payload.sub, role: payload.role as UserRole };
    } catch {
      return null;
    }
  }

  // Refresh token: random and opaque, only its hash goes to the database
  newRefreshToken() {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
