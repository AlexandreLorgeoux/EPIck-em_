import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { REFRESH_TOKEN_TTL_DAYS } from './auth.config.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';

// What the API ever shows of an account: never the password hash
export const publicUser = {
  id: true,
  email: true,
  displayName: true,
  role: true,
  createdAt: true,
} as const;

type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'player' | 'user';
  createdAt: Date;
};

export type SignedIn = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

const refreshExpiry = () =>
  new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  // Self-registration always creates a plain user: roles are granted by an admin
  async register(dto: RegisterDto, userAgent?: string): Promise<SignedIn> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException(
        'An account already uses this email: sign in instead',
      );
    }
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        displayName: dto.displayName,
        passwordHash: await this.passwords.hash(dto.password),
      },
      select: publicUser,
    });
    return this.startSession(user, userAgent);
  }

  async login(dto: LoginDto, userAgent?: string): Promise<SignedIn> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid = user?.passwordHash
      ? await this.passwords.verify(user.passwordHash, dto.password)
      : await this.passwords.verifyAgainstNothing(dto.password);
    // Same message whether the email or the password is wrong
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const { id, email, displayName, role, createdAt } = user;
    return this.startSession(
      { id, email, displayName, role, createdAt },
      userAgent,
    );
  }

  // Swaps a refresh token for a new pair. The old refresh token stops
  // working, and the role is read again so role changes take effect.
  async refresh(refreshToken: string | undefined): Promise<SignedIn> {
    const expired = new UnauthorizedException(
      'Your session has expired: sign in again',
    );
    if (!refreshToken) throw expired;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: this.tokens.hashRefreshToken(refreshToken) },
      include: { user: { select: publicUser } },
    });
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw expired;
    }

    const next = this.tokens.newRefreshToken();
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        tokenHash: this.tokens.hashRefreshToken(next),
        expiresAt: refreshExpiry(),
        lastUsedAt: new Date(),
      },
    });
    return {
      user: session.user,
      accessToken: await this.tokens.signAccessToken(session.user),
      refreshToken: next,
    };
  }

  async logout(refreshToken: string | undefined) {
    if (!refreshToken) return;
    await this.prisma.session.updateMany({
      where: {
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
  }

  // Signs the user out everywhere, for example after a role change
  async revokeAllSessions(userId: string) {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: publicUser,
    });
    if (!user) throw new UnauthorizedException('This account no longer exists');
    return user;
  }

  private async startSession(
    user: PublicUser,
    userAgent?: string,
  ): Promise<SignedIn> {
    const refreshToken = this.tokens.newRefreshToken();
    await this.prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        expiresAt: refreshExpiry(),
        userAgent: userAgent?.slice(0, 255),
      },
    });
    return {
      user,
      accessToken: await this.tokens.signAccessToken(user),
      refreshToken,
    };
  }
}
