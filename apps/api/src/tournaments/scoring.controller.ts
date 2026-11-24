import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public, Roles } from '../auth/roles.decorator.js';
import { uuidParam } from '../common/uuid-param.pipe.js';
import { SetScoringDto } from './dto/set-scoring.dto.js';
import { ScoringService } from './scoring.service.js';

@Controller('tournaments/:id/scoring')
export class ScoringController {
  constructor(private readonly scoring: ScoringService) {}

  // Public: players should know how their predictions are scored
  @Public()
  @Get()
  get(@Param('id', uuidParam()) id: string, @CurrentUser() user?: AuthUser) {
    return this.scoring.get(id, user);
  }

  @Roles('admin')
  @Put()
  set(
    @Param('id', uuidParam()) id: string,
    @Body() dto: SetScoringDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.scoring.set(id, dto, user);
  }
}
