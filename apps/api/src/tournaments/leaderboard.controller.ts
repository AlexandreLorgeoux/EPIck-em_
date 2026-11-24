import { Controller, Get, Headers, Param, Query, Sse } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Public } from '../auth/roles.decorator.js';
import { uuidParam } from '../common/uuid-param.pipe.js';
import { LeaderboardQuery } from './dto/leaderboard.query.js';
import { LeaderboardService } from './leaderboard.service.js';
import { TournamentEventsService } from './tournament-events.service.js';
import { TournamentsService } from './tournaments.service.js';

// Public, like the tournament: anyone follows its ranking and its changes
@Controller('tournaments/:id')
export class LeaderboardController {
  constructor(
    private readonly leaderboard: LeaderboardService,
    private readonly events: TournamentEventsService,
    private readonly tournaments: TournamentsService,
  ) {}

  @Public()
  @Get('leaderboard')
  get(
    @Param('id', uuidParam()) id: string,
    @Query() query: LeaderboardQuery,
    @CurrentUser() user?: AuthUser,
  ) {
    return this.leaderboard.get(id, query, user);
  }

  // Server-sent events: sync, then match-result, bracket and leaderboard
  @Public()
  @Sse('events')
  async stream(
    @Param('id', uuidParam()) id: string,
    @Headers('last-event-id') lastEventId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    // A draft answers 404 here, before the stream opens
    const tournament = await this.tournaments.findOne(id, user);
    return this.events.stream(tournament.id, lastEventId);
  }
}
