import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';

// Creates the first admin from ADMIN_EMAIL and ADMIN_PASSWORD, since
// self-registration only ever creates spectators. Does nothing once the
// account exists, so the variables can stay set.
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('AdminBootstrap');

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async onApplicationBootstrap() {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;
    if (password.length < 8) {
      this.logger.error(
        'ADMIN_PASSWORD must be at least 8 characters: no admin created',
      );
      return;
    }
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== 'admin') {
        this.logger.warn(
          `${email} exists but is not an admin: change its role from another admin account`,
        );
      }
      return;
    }
    await this.prisma.user.create({
      data: {
        email,
        displayName: process.env.ADMIN_DISPLAY_NAME?.trim() || 'Admin',
        role: 'admin',
        passwordHash: await this.passwords.hash(password),
      },
    });
    this.logger.log(`Created admin account ${email}`);
  }
}
