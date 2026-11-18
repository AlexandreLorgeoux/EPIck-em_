import { Body, Controller, Param, Post } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import { uuidParam } from '../common/uuid-param.pipe.js';
import { RecordResultDto } from './dto/record-result.dto.js';
import { MatchResultsService } from './match-results.service.js';

@Controller('matches/:id/result')
export class MatchResultsController {
  constructor(private readonly results: MatchResultsService) {}

  // Enters the score of a match and moves the winner forward
  @Roles('admin')
  @Post()
  record(
    @Param('id', uuidParam()) id: string,
    @Body() dto: RecordResultDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.results.record(id, dto, user);
  }
}
