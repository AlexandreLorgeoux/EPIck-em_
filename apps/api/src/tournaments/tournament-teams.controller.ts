import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { uuidParam } from '../common/uuid-param.pipe.js';
import { AddTeamDto } from './dto/add-team.dto.js';
import { SetSeedingDto } from './dto/set-seeding.dto.js';
import { TournamentTeamsService } from './tournament-teams.service.js';

@Controller('tournaments/:id')
export class TournamentTeamsController {
  constructor(private readonly teams: TournamentTeamsService) {}

  @Public()
  @Get('teams')
  list(@Param('id', uuidParam()) id: string, @CurrentUser() user?: AuthUser) {
    return this.teams.list(id, user);
  }

  @Roles('admin')
  @Post('teams')
  add(@Param('id', uuidParam()) id: string, @Body() dto: AddTeamDto) {
    return this.teams.add(id, dto);
  }

  @Roles('admin')
  @Delete('teams/:teamId')
  @HttpCode(204)
  remove(
    @Param('id', uuidParam()) id: string,
    @Param('teamId', uuidParam('teamId')) teamId: string,
  ) {
    return this.teams.remove(id, teamId);
  }

  @Roles('admin')
  @Put('seeding')
  setSeeding(@Param('id', uuidParam()) id: string, @Body() dto: SetSeedingDto) {
    return this.teams.setSeeding(id, dto);
  }
}
