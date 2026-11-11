import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_COOKIE,
  REFRESH_TOKEN_TTL_DAYS,
  secureCookies,
} from './auth.config.js';
import type { AuthUser } from './auth-user.js';
import { AuthService, SignedIn } from './auth.service.js';
import { CurrentUser } from './current-user.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { Public } from './roles.decorator.js';

// httpOnly: scripts cannot read the tokens. SameSite=Lax: other sites cannot
// send them with a POST, which blocks cross-site request forgery.
const cookieOptions = (maxAgeMs: number): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: secureCookies(),
  path: '/',
  maxAge: maxAgeMs,
});

const refreshCookie = (req: Request) =>
  (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.setCookies(res, await this.auth.register(dto, userAgent));
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.setCookies(res, await this.auth.login(dto, userAgent));
  }

  // Public: it is called precisely when the access token has expired
  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      return this.setCookies(res, await this.auth.refresh(refreshCookie(req)));
    } catch (error) {
      this.clearCookies(res);
      throw error;
    }
  }

  // Public: signing out must work even with an expired access token
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(refreshCookie(req));
    this.clearCookies(res);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  private setCookies(res: Response, signedIn: SignedIn) {
    res.cookie(
      ACCESS_COOKIE,
      signedIn.accessToken,
      cookieOptions(ACCESS_TOKEN_TTL_SECONDS * 1000),
    );
    res.cookie(
      REFRESH_COOKIE,
      signedIn.refreshToken,
      cookieOptions(REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    );
    // Tokens travel only in cookies, never in the body
    return signedIn.user;
  }

  private clearCookies(res: Response) {
    const { maxAge: _, ...options } = cookieOptions(0);
    res.clearCookie(ACCESS_COOKIE, options);
    res.clearCookie(REFRESH_COOKIE, options);
  }
}
