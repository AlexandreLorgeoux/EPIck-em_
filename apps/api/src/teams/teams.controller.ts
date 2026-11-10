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
import { Roles } from '../auth/roles.decorator.js';
import { uuidParam } from '../common/uuid-param.pipe.js';
import { AddMemberDto } from './dto/add-member.dto.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { TeamsService } from './teams.service.js';

@Controller('teams')
@Roles('admin')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Post()
  create(@Body() dto: CreateTeamDto) {
    return this.teams.create(dto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.teams.findAll(search?.trim() || undefined);
  }

  @Get(':id')
  findOne(@Param('id', uuidParam()) id: string) {
    return this.teams.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', uuidParam()) id: string, @Body() dto: UpdateTeamDto) {
    return this.teams.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', uuidParam()) id: string) {
    return this.teams.remove(id);
  }

  @Post(':id/members')
  addMember(@Param('id', uuidParam()) id: string, @Body() dto: AddMemberDto) {
    return this.teams.addMember(id, dto);
  }

  @Delete(':id/members/:playerId')
  removeMember(
    @Param('id', uuidParam()) id: string,
    @Param('playerId', uuidParam('playerId')) playerId: string,
  ) {
    return this.teams.removeMember(id, playerId);
  }
}
