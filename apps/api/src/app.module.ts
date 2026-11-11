import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module.js';
import { RolesGuard } from './auth/roles.guard.js';
import { PlayersModule } from './players/players.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, PlayersModule, TeamsModule],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: RolesGuard }],
})
export class AppModule {}
