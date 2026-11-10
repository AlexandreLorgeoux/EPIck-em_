import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './auth/roles.guard.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
