import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { uuidParam } from '../common/uuid-param.pipe.js';
import { CreateTournamentDto } from './dto/create-tournament.dto.js';
import { ListTournamentsQuery } from './dto/list-tournaments.query.js';
import { UpdateTournamentDto } from './dto/update-tournament.dto.js';
import { TournamentsService } from './tournaments.service.js';

@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  // Public: anyone follows tournaments; admins also see drafts
  @Public()
  @Get()
  findAll(
    @Query() query: ListTournamentsQuery,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.tournaments.findAll(query, user);
  }

  @Public()
  @Get(':idOrSlug')
  findOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: AuthUser) {
    return this.tournaments.findOne(idOrSlug, user);
  }

  @Roles('admin')
  @Post()
  create(@Body() dto: CreateTournamentDto, @CurrentUser() user: AuthUser) {
    return this.tournaments.create(dto, user);
  }

  @Roles('admin')
  @Patch(':id')
  update(
    @Param('id', uuidParam()) id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournaments.update(id, dto);
  }

  @Roles('admin')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', uuidParam()) id: string) {
    return this.tournaments.remove(id);
  }
}
