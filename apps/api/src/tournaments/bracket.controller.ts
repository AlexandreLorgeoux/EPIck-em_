import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { uuidParam } from '../common/uuid-param.pipe.js';
import { BracketService } from './bracket.service.js';
import { GenerateBracketDto } from './dto/generate-bracket.dto.js';

@Controller('tournaments/:id/bracket')
export class BracketController {
  constructor(private readonly bracket: BracketService) {}

  @Public()
  @Get()
  get(@Param('id', uuidParam()) id: string, @CurrentUser() user?: AuthUser) {
    return this.bracket.get(id, user);
  }

  // Generates the bracket and starts the tournament
  @Roles('admin')
  @Post()
  generate(
    @Param('id', uuidParam()) id: string,
    @Body() dto: GenerateBracketDto,
  ) {
    return this.bracket.generate(id, dto);
  }
}
