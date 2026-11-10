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
import { CreatePlayerDto } from './dto/create-player.dto.js';
import { UpdatePlayerDto } from './dto/update-player.dto.js';
import { PlayersService } from './players.service.js';

@Controller('players')
@Roles('admin')
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Post()
  create(@Body() dto: CreatePlayerDto) {
    return this.players.create(dto);
  }

  @Get()
  findAll(@Query('search') search?: string) {
    return this.players.findAll(search?.trim() || undefined);
  }

  @Get(':id')
  findOne(@Param('id', uuidParam()) id: string) {
    return this.players.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', uuidParam()) id: string, @Body() dto: UpdatePlayerDto) {
    return this.players.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', uuidParam()) id: string) {
    return this.players.remove(id);
  }
}
