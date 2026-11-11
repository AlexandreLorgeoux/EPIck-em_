import type { NextFunction, Request, Response } from 'express';
import { ACCESS_COOKIE } from './auth.config.js';
import type { AuthUser } from './auth-user.js';
import type { TokenService } from './token.service.js';

// Turns a valid access-token cookie into request.user. An invalid or expired
// token is ignored: the RolesGuard then answers 401 where a user is required.
export const authenticate =
  (tokens: TokenService) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = (req.cookies as Record<string, string> | undefined)?.[
      ACCESS_COOKIE
    ];
    if (token) {
      const user = await tokens.verifyAccessToken(token);
      if (user) (req as Request & { user?: AuthUser }).user = user;
    }
    next();
  };
